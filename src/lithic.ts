import { loadConfig, checkGuardrails } from "./config.js";
import type { LithicCard } from "./types.js";

let _config: { baseUrl: string; apiKey: string } | null = null;

/**
 * Returns a singleton Lithic config object.
 * Reads LITHIC_API_KEY from the environment at call time, not at module load time.
 */
export function _getLithicConfig(): { baseUrl: string; apiKey: string } {
  if (_config) return _config;
  const cfg = loadConfig();
  const apiKey = process.env.LITHIC_API_KEY ?? cfg.lithic?.apiKey;
  if (!apiKey) throw new Error("LITHIC_API_KEY not configured. Run setup_lithic first.");
  const baseUrl =
    cfg.lithic?.environment === "production"
      ? "https://api.lithic.com/v1"
      : "https://sandbox.lithic.com/v1";
  _config = { baseUrl, apiKey };
  return _config;
}

/**
 * Resets the cached Lithic config.
 * Useful in tests or after rotating the API key.
 */
export function resetLithicConfig(): void {
  _config = null;
}

/**
 * Wraps PAN, CVV, and expiry data.
 * toJSON() returns [REDACTED] for all fields — ensures JSON.stringify never leaks card data.
 */
class SensitiveCardData {
  readonly pan: string;
  readonly cvv: string;
  readonly expMonth: string;
  readonly expYear: string;

  constructor(pan: string, cvv: string, expMonth: string, expYear: string) {
    this.pan = pan;
    this.cvv = cvv;
    this.expMonth = expMonth;
    this.expYear = expYear;
  }

  toJSON() {
    return { pan: "[REDACTED]", cvv: "[REDACTED]", expMonth: "[REDACTED]", expYear: "[REDACTED]" };
  }
}

/**
 * Creates a single-use virtual card with the given spend limit.
 * Runs guardrail checks before issuing any API call.
 * Returns a LithicCard (token + lastFour + state only — no PAN/CVV).
 */
export async function createSingleUseCard(spendLimitCents: number): Promise<LithicCard> {
  const guardrail = checkGuardrails(spendLimitCents, "usd");
  if (!guardrail.allowed) throw new Error(`Card creation blocked: ${guardrail.reason}`);

  const { baseUrl, apiKey } = _getLithicConfig();
  const resp = await fetch(`${baseUrl}/cards`, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "SINGLE_USE",
      spend_limit: spendLimitCents,
      spend_limit_duration: "TRANSACTION",
    }),
  });
  if (!resp.ok) throw new Error(`Lithic card creation failed: ${resp.status}`);
  const data = (await resp.json()) as {
    token: string;
    last_four: string;
    state: string;
    spend_limit: number;
  };
  return {
    token: data.token,
    lastFour: data.last_four,
    state: data.state,
    spendLimitCents: data.spend_limit,
  };
}

/**
 * Retrieves PAN, CVV, and expiry for a card token.
 * Returns a SensitiveCardData instance whose toJSON() redacts all fields.
 * NEVER log or throw the raw values returned from this function.
 */
export async function getCardDetails(cardToken: string): Promise<SensitiveCardData> {
  const { baseUrl, apiKey } = _getLithicConfig();
  const resp = await fetch(`${baseUrl}/cards/${cardToken}`, {
    headers: { Authorization: apiKey },
  });
  if (!resp.ok) throw new Error(`Lithic get card details failed: ${resp.status}`);
  const data = (await resp.json()) as {
    pan: string;
    cvv: string;
    exp_month: string;
    exp_year: string;
  };
  // NEVER log data.pan, data.cvv, or card numbers
  return new SensitiveCardData(data.pan, data.cvv, String(data.exp_month), String(data.exp_year));
}

/**
 * Closes a virtual card, preventing any further spend.
 * Sends PATCH /v1/cards/{token} with { state: "CLOSED" }.
 */
export async function closeCard(cardToken: string): Promise<void> {
  const { baseUrl, apiKey } = _getLithicConfig();
  const resp = await fetch(`${baseUrl}/cards/${cardToken}`, {
    method: "PATCH",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ state: "CLOSED" }),
  });
  if (!resp.ok) throw new Error(`Lithic close card failed: ${resp.status}`);
}
