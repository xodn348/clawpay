import Stripe from "stripe";
import { loadConfig, checkGuardrails, recordSpend } from "./config.js";
import { auditPayment, auditRefund } from "./guardrails.js";
import type { PaymentRequest, PaymentResult, BalanceInfo, Transaction, RefundResult } from "./types.js";

// Lazily-initialized Stripe client — avoids crashing at import time when the key is absent.
let _stripe: Stripe | null = null;

/**
 * Returns a singleton Stripe client.
 * Reads STRIPE_SECRET_KEY from the environment at call time, not at module load time.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY environment variable is not set. " +
        "Run 'clawpay install' to configure or set it manually.",
    );
  }
  _stripe = new Stripe(key);
  return _stripe;
}

/**
 * Resets the cached Stripe client.
 * Useful in tests or after rotating the API key.
 */
export function resetStripe(): void {
  _stripe = null;
}

/**
 * Checks that the Stripe key is valid by calling the balance endpoint.
 * Returns the account object name on success, or an error message on failure.
 */
export async function verifyConnection(): Promise<{
  valid: boolean;
  accountName?: string;
  error?: string;
}> {
  try {
    const stripe = getStripe();
    const balance = await stripe.balance.retrieve();
    return { valid: true, accountName: balance.object };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, error: message };
  }
}

/**
 * Creates a PaymentIntent and immediately confirms it (off-session).
 * Guardrail checks run before any Stripe call so no partial state is left on rejection.
 */
export async function createPayment(request: PaymentRequest): Promise<PaymentResult> {
  const guardrail = checkGuardrails(request.amount, request.currency);
  if (!guardrail.allowed) {
    auditPayment({
      amount: request.amount,
      currency: request.currency,
      status: "blocked",
      reason: guardrail.reason,
    });
    return { success: false, error: `Payment blocked: ${guardrail.reason}` };
  }

  const config = loadConfig();
  if (!config.stripe.customerId || !config.stripe.paymentMethodId) {
    return {
      success: false,
      error: "Payment method not configured. Call setup_payment tool first.",
    };
  }

  try {
    const stripe = getStripe();
    // Idempotency key prevents duplicate charges when the network retries a request.
    const idempotencyKey =
      request.idempotencyKey ??
      `clawpay-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const intent = await stripe.paymentIntents.create(
      {
        amount: request.amount,
        currency: request.currency.toLowerCase(),
        customer: config.stripe.customerId,
        payment_method: config.stripe.paymentMethodId,
        description: request.description,
        confirm: true,
        // off_session is required: agent payments happen without the user present.
        off_session: true,
        metadata: {
          source: "clawpay",
          ...request.metadata,
        },
      },
      { idempotencyKey },
    );

    const succeeded = intent.status === "succeeded";
    if (succeeded) {
      recordSpend(request.amount);
    }

    auditPayment({
      amount: request.amount,
      currency: request.currency,
      paymentIntentId: intent.id,
      status: succeeded ? "success" : "failed",
      reason: succeeded ? undefined : `Stripe status: ${intent.status}`,
    });

    return {
      success: succeeded,
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      error: succeeded ? undefined : `Payment status: ${intent.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    auditPayment({
      amount: request.amount,
      currency: request.currency,
      status: "failed",
      reason: message,
    });
    return { success: false, error: message };
  }
}

/**
 * Returns the current Stripe account balance split into available and pending funds.
 */
export async function getBalance(): Promise<BalanceInfo> {
  const stripe = getStripe();
  const balance = await stripe.balance.retrieve();
  return {
    available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
    pending: balance.pending.map((b) => ({ amount: b.amount, currency: b.currency })),
  };
}

/**
 * Lists recent PaymentIntents ordered by creation time (newest first).
 * Capped at 100 per Stripe API limits.
 */
export async function listTransactions(limit = 10): Promise<Transaction[]> {
  const stripe = getStripe();
  const intents = await stripe.paymentIntents.list({ limit: Math.min(limit, 100) });
  return intents.data.map((pi) => ({
    id: pi.id,
    amount: pi.amount,
    currency: pi.currency,
    description: pi.description ?? "",
    status: pi.status,
    created: pi.created,
  }));
}

/**
 * Issues a full refund for an existing PaymentIntent.
 * Partial refunds are not supported by design — keep the surface area minimal.
 */
export async function refundPayment(paymentIntentId: string): Promise<RefundResult> {
  try {
    const stripe = getStripe();
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    auditRefund({ refundId: refund.id, amount: refund.amount, status: "success" });
    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status ?? "unknown",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    auditRefund({ status: "failed", reason: message });
    return { success: false, error: message };
  }
}
