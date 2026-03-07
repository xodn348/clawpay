export interface PayPalConfig {
  clientId?: string;
  clientSecret?: string;
  environment: "sandbox" | "production";
  // Access token is stored in memory only (never on disk)
}

export interface SendMoneyRequest {
  recipientEmail?: string;
  recipientPhone?: string;
  amountCents: number;
  currency: string;
  note?: string;
}

export interface SendMoneyResult {
  success: boolean;
  payoutBatchId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: string;
}

export interface ClawPayConfig {
  stripe: {
    customerId?: string;
    paymentMethodId?: string;
  };
  server: {
    port: number;
  };
  guardrails: {
    maxAmountPerTransactionCents: number;
    maxDailySpendCents: number;
    allowedCurrencies: string[];
    requireConfirmation: boolean;
  };
  paypal?: PayPalConfig;
}

export const DEFAULT_CONFIG: ClawPayConfig = {
  stripe: {},
  server: { port: 3100 },
  guardrails: {
    maxAmountPerTransactionCents: 10000,
    maxDailySpendCents: 50000,
    allowedCurrencies: ["usd"],
    requireConfirmation: false,
  },
  paypal: {
    environment: "sandbox" as const,
  },
};

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  created: number;
}

export interface BalanceInfo {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}

export interface GuardrailCheck {
  allowed: boolean;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: string;
  error?: string;
}

export interface StripeCliConfig {
  deviceName?: string;
  displayName?: string;
  accountId?: string;
  testModeApiKey?: string;
  testModePubKey?: string;
  testModeKeyExpiresAt?: string;
  liveModeApiKey?: string;
  liveModePubKey?: string;
  liveModeKeyExpiresAt?: string;
}
