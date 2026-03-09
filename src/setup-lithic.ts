import { loadConfig, saveConfig } from "./config.js";
import { auditLithicSetup } from "./guardrails.js";
import type { LithicConfig } from "./types.js";

export async function runLithicSetup(): Promise<{ success: boolean; message: string }> {
  const envApiKey = process.env.LITHIC_API_KEY;
  const envEnvironment = process.env.LITHIC_ENVIRONMENT;
  const credentialsFromEnv = Boolean(envApiKey);

  if (!credentialsFromEnv) {
    const config = loadConfig();
    if (!config.lithic?.apiKey) {
      return {
        success: false,
        message: "Lithic API key not found. Set LITHIC_API_KEY environment variable.",
      };
    }
  }

  const environment: "sandbox" | "production" =
    envEnvironment === "production" ? "production" : "sandbox";
  const baseUrl =
    environment === "production" ? "https://api.lithic.com/v1" : "https://sandbox.lithic.com/v1";
  const apiKey = envApiKey || loadConfig().lithic?.apiKey;

  if (!apiKey) {
    return {
      success: false,
      message: "Lithic API key not found. Set LITHIC_API_KEY environment variable.",
    };
  }

  const resp = await fetch(`${baseUrl}/cards?limit=1`, {
    headers: { Authorization: apiKey },
  });

  if (!resp.ok) {
    const errorMessage = "Lithic connection failed. Check your API key.";
    auditLithicSetup("failed", errorMessage);
    return { success: false, message: errorMessage };
  }

  if (credentialsFromEnv) {
    const config = loadConfig();
    const lithicConfig: LithicConfig = {
      ...(config.lithic ?? { environment: "sandbox" }),
      apiKey: envApiKey!,
      environment,
    };
    saveConfig({ ...config, lithic: lithicConfig });
  }

  auditLithicSetup("success");
  return { success: true, message: "Lithic configured successfully." };
}
