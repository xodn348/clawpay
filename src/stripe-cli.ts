import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { StripeCliConfig } from "./types.js";

function parseToml(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection: string | null = null;

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    if (currentSection === null) {
      continue;
    }

    const kvMatch = trimmed.match(/^([a-z_]+)\s*=\s*(.+)$/);
    if (!kvMatch) {
      continue;
    }

    const key = kvMatch[1];
    const valueStr = kvMatch[2].trim();

    if (valueStr.startsWith("[")) {
      continue;
    }

    if (valueStr === "true" || valueStr === "false") {
      continue;
    }

    const quotedMatch = valueStr.match(/^['"]([^'"]*)['"]\s*$/);
    if (quotedMatch) {
      const value = quotedMatch[1];
      result[currentSection][key] = value;
    }
  }

  return result;
}

export const _parseToml: { fn: typeof parseToml } = { fn: parseToml };

export { parseToml };

export function getStripeCliConfigPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "stripe", "config.toml");
  }
  return join(homedir(), ".config", "stripe", "config.toml");
}

export const _spawnSyncCli: { fn: typeof spawnSync } = { fn: spawnSync };

export function isStripeCliInstalled(): boolean {
  const result = _spawnSyncCli.fn("which", ["stripe"], { encoding: "utf-8" });
  return result.status === 0;
}

export function isStripeCliLoggedIn(): StripeCliConfig | null {
  let content: string;
  try {
    content = readFileSync(getStripeCliConfigPath(), "utf-8");
  } catch {
    return null;
  }

  const parsed = _parseToml.fn(content);
  const defaults = parsed["default"] ?? null;
  if (!defaults) {
    return null;
  }

  const config: StripeCliConfig = {
    deviceName: defaults["device_name"],
    displayName: defaults["display_name"],
    accountId: defaults["account_id"],
    testModeApiKey: defaults["test_mode_api_key"],
    testModePubKey: defaults["test_mode_pub_key"],
    testModeKeyExpiresAt: defaults["test_mode_key_expires_at"],
    liveModeApiKey: defaults["live_mode_api_key"],
    liveModePubKey: defaults["live_mode_pub_key"],
    liveModeKeyExpiresAt: defaults["live_mode_key_expires_at"],
  };

  if (!config.testModeApiKey) {
    return null;
  }

  return config;
}

export function isKeyExpired(expiresAt: string): boolean {
  const expiryDate = new Date(expiresAt + "T00:00:00Z");
  return expiryDate < new Date();
}

export function readLiveKeyFromKeychain(): string | null {
  if (process.platform !== "darwin") {
    return null;
  }

  const result = _spawnSyncCli.fn(
    "security",
    [
      "find-generic-password",
      "-s",
      "StripeCLI",
      "-a",
      "default.live_mode_api_key",
      "-w",
    ],
    { encoding: "utf-8" }
  );

  if (result.status !== 0) {
    return null;
  }

  const key = (result.stdout as string).trim();
  if (!/(sk|rk)_live_/.test(key)) {
    return null;
  }

  return key;
}

export function detectStripeKey(): {
  key: string;
  source: "cli" | "manual";
  mode: "test" | "live";
  expiresAt?: string;
} | null {
  const envKey = process.env.STRIPE_API_KEY;
  if (envKey) {
    return {
      key: envKey,
      source: "cli",
      mode: envKey.includes("_live_") ? "live" : "test",
    };
  }

  if (!isStripeCliInstalled()) {
    return null;
  }

  const config = isStripeCliLoggedIn();
  if (!config) {
    return null;
  }

  if (config.testModeApiKey) {
    if (isKeyExpired(config.testModeKeyExpiresAt ?? "")) {
      console.warn(
        `⚠ Stripe CLI key expired on ${config.testModeKeyExpiresAt}. Run 'stripe login' to refresh.`
      );
    }
    return {
      key: config.testModeApiKey,
      source: "cli",
      mode: "test",
      expiresAt: config.testModeKeyExpiresAt,
    };
  }

  if (config.liveModeApiKey && config.liveModeApiKey.includes("***")) {
    const keychainKey = readLiveKeyFromKeychain();
    if (keychainKey) {
      return {
        key: keychainKey,
        source: "cli",
        mode: "live",
        expiresAt: config.liveModeKeyExpiresAt,
      };
    }
    return null;
  }

  return null;
}
