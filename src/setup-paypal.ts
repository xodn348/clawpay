import { loadConfig, saveConfig } from "./config.js";
import { auditPayPalSetup } from "./guardrails.js";
import { verifyPayPalConnection } from "./paypal.js";
import type { PayPalConfig } from "./types.js";

export async function runPayPalSetup(): Promise<{ success: boolean; message: string }> {
  const envClientId = process.env.PAYPAL_CLIENT_ID;
  const envClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const envEnvironment = process.env.PAYPAL_ENVIRONMENT;
  const credentialsFromEnv = Boolean(envClientId && envClientSecret);

  if (!credentialsFromEnv) {
    const config = loadConfig();
    if (!config.paypal?.clientId || !config.paypal?.clientSecret) {
      return {
        success: false,
        message:
          "PayPal credentials not found. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.",
      };
    }
  }

  const connected = await verifyPayPalConnection();

  if (!connected) {
    const errorMessage = "PayPal connection failed. Check your Client ID and Client Secret.";
    auditPayPalSetup("failed", errorMessage);
    return { success: false, message: errorMessage };
  }

  if (credentialsFromEnv) {
    const config = loadConfig();
    const environment: "sandbox" | "production" =
      envEnvironment === "production" ? "production" : "sandbox";
    const paypalConfig: PayPalConfig = {
      ...(config.paypal ?? { environment: "sandbox" }),
      clientId: envClientId!,
      clientSecret: envClientSecret!,
      environment,
    };
    saveConfig({ ...config, paypal: paypalConfig });
  }

  auditPayPalSetup("success");
  return { success: true, message: "PayPal configured successfully." };
}
