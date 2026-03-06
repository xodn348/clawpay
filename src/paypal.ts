import { loadConfig, checkGuardrails, recordSpend } from "./config.js";
import { auditPayPalSend } from "./guardrails.js";
import type { SendMoneyRequest, SendMoneyResult } from "./types.js";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const config = loadConfig();
  const clientId = config.paypal?.clientId ?? process.env.PAYPAL_CLIENT_ID;
  const clientSecret = config.paypal?.clientSecret ?? process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured. Run setup_paypal first.");
  }

  const env = config.paypal?.environment ?? "sandbox";
  const baseUrl = env === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`PayPal OAuth failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

export async function verifyPayPalConnection(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

export async function sendMoney(request: SendMoneyRequest): Promise<SendMoneyResult> {
  const guardrail = checkGuardrails(request.amountCents, request.currency);
  if (!guardrail.allowed) {
    auditPayPalSend({
      amount: request.amountCents,
      currency: request.currency,
      recipientEmail: request.recipientEmail,
      recipientPhone: request.recipientPhone,
      status: "blocked",
      reason: guardrail.reason,
    });
    return { success: false, error: guardrail.reason };
  }

  if (!request.recipientEmail && !request.recipientPhone) {
    return { success: false, error: "Either recipientEmail or recipientPhone is required." };
  }

  try {
    const accessToken = await getAccessToken();
    const config = loadConfig();
    const env = config.paypal?.environment ?? "sandbox";
    const baseUrl = env === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const receiverType = request.recipientEmail ? "EMAIL" : "PHONE";
    const receiverValue = request.recipientEmail ?? request.recipientPhone!;
    const batchId = `clawpay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const amountDecimal = (request.amountCents / 100).toFixed(2);

    const payload = {
      sender_batch_header: {
        sender_batch_id: batchId,
        email_subject: "You have a payment",
        email_message: request.note ?? "Payment sent via ClawPay",
      },
      items: [
        {
          recipient_type: receiverType,
          receiver: receiverValue,
          amount: {
            value: amountDecimal,
            currency: request.currency.toUpperCase(),
          },
          note: request.note ?? "",
          sender_item_id: `item-${batchId}`,
        },
      ],
    };

    const response = await fetch(`${baseUrl}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      auditPayPalSend({
        amount: request.amountCents,
        currency: request.currency,
        recipientEmail: request.recipientEmail,
        recipientPhone: request.recipientPhone,
        status: "failed",
        reason: `PayPal API error ${response.status}: ${errorBody}`,
      });
      return { success: false, error: `PayPal API error: ${response.status}` };
    }

    const result = (await response.json()) as {
      batch_header: { payout_batch_id: string; batch_status: string };
    };

    recordSpend(request.amountCents);

    auditPayPalSend({
      amount: request.amountCents,
      currency: request.currency,
      recipientEmail: request.recipientEmail,
      recipientPhone: request.recipientPhone,
      payoutBatchId: result.batch_header.payout_batch_id,
      status: "success",
    });

    return {
      success: true,
      payoutBatchId: result.batch_header.payout_batch_id,
      amount: request.amountCents,
      currency: request.currency,
      status: result.batch_header.batch_status,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    auditPayPalSend({
      amount: request.amountCents,
      currency: request.currency,
      recipientEmail: request.recipientEmail,
      recipientPhone: request.recipientPhone,
      status: "failed",
      reason: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}
