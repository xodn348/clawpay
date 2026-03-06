import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ClawPayConfig, GuardrailCheck } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

const CONFIG_DIR = join(homedir(), ".clawpay");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): ClawPayConfig {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ClawPayConfig;
  }
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const saved = JSON.parse(raw) as Partial<ClawPayConfig>;
    return {
      stripe: { ...DEFAULT_CONFIG.stripe, ...saved.stripe },
      server: { ...DEFAULT_CONFIG.server, ...saved.server },
      guardrails: { ...DEFAULT_CONFIG.guardrails, ...saved.guardrails },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ClawPayConfig;
  }
}

export function saveConfig(config: ClawPayConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function isConfigured(): boolean {
  const config = loadConfig();
  return Boolean(config.stripe.customerId && config.stripe.paymentMethodId);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function spendLogFile(): string {
  return join(CONFIG_DIR, `spend-${todayKey()}.json`);
}

interface SpendLog {
  date: string;
  totalCents: number;
}

function loadSpendLog(): SpendLog {
  ensureConfigDir();
  const file = spendLogFile();
  if (!existsSync(file)) {
    return { date: todayKey(), totalCents: 0 };
  }
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as SpendLog;
  } catch {
    return { date: todayKey(), totalCents: 0 };
  }
}

export function getDailySpend(): number {
  return loadSpendLog().totalCents;
}

export function recordSpend(amountCents: number): void {
  ensureConfigDir();
  const log = loadSpendLog();
  log.totalCents += amountCents;
  writeFileSync(spendLogFile(), JSON.stringify(log, null, 2), "utf-8");
}

export function checkGuardrails(amountCents: number, currency: string): GuardrailCheck {
  const config = loadConfig();
  const { guardrails } = config;

  if (amountCents <= 0) {
    return { allowed: false, reason: "Amount must be greater than zero." };
  }

  if (!guardrails.allowedCurrencies.includes(currency.toLowerCase())) {
    return {
      allowed: false,
      reason: `Currency "${currency}" is not allowed. Allowed: ${guardrails.allowedCurrencies.join(", ")}.`,
    };
  }

  if (amountCents > guardrails.maxAmountPerTransactionCents) {
    const max = (guardrails.maxAmountPerTransactionCents / 100).toFixed(2);
    const requested = (amountCents / 100).toFixed(2);
    return {
      allowed: false,
      reason: `Amount $${requested} exceeds per-transaction limit of $${max}.`,
    };
  }

  const daily = getDailySpend();
  if (daily + amountCents > guardrails.maxDailySpendCents) {
    const limit = (guardrails.maxDailySpendCents / 100).toFixed(2);
    const spent = (daily / 100).toFixed(2);
    return {
      allowed: false,
      reason: `Would exceed daily spend limit of $${limit} (today: $${spent}).`,
    };
  }

  return { allowed: true };
}
