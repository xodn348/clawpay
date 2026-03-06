import assert from "node:assert";
import { after, before, describe, it, mock } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const testHome = mkdtempSync(join(tmpdir(), "clawpay-integration-"));
const clawpayDir = join(testHome, ".clawpay");

process.env.HOME = testHome;
process.env.USERPROFILE = testHome;

type ConfigModule = typeof import("../src/config.js");
type GuardrailsModule = typeof import("../src/guardrails.js");
type PaypalModule = typeof import("../src/paypal.js");

let configModule: ConfigModule;
let guardrailsModule: GuardrailsModule;
let paypalModule: PaypalModule;

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function requestToolsList(): Promise<unknown[]> {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      STRIPE_SECRET_KEY: "sk_test_fake",
      HOME: testHome,
      USERPROFILE: testHome,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdoutText = "";
  const stderrChunks: string[] = [];

  const responsePromise = new Promise<unknown[]>((resolvePromise, rejectPromise) => {
    const childEvents = child as unknown as {
      on(event: string, listener: (...args: unknown[]) => void): void;
    };
    const timeout = setTimeout(() => {
      child.kill();
      rejectPromise(new Error("Timed out waiting for MCP tools/list response."));
    }, 8000);

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString("utf8"));
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutText += chunk.toString("utf8");

      const lines = stdoutText.split("\n");
      stdoutText = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          clearTimeout(timeout);
          child.kill();
          rejectPromise(new Error(`Failed to parse MCP JSON response line: ${trimmed}`));
          return;
        }

        if (parsed && typeof parsed === "object" && "id" in parsed && (parsed as { id?: unknown }).id === 1) {
          clearTimeout(timeout);
          child.kill();
          const result = (parsed as { result?: { tools?: unknown[] }; error?: unknown }).result;
          if (!result || !Array.isArray(result.tools)) {
            const errorText = JSON.stringify((parsed as { error?: unknown }).error);
            rejectPromise(new Error(`MCP tools/list failed. error=${errorText}, stderr=${stderrChunks.join("")}`));
            return;
          }
          resolvePromise(result.tools);
          return;
        }
      }
    });

    childEvents.on("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(error as Error);
    });

    childEvents.on("exit", (code) => {
      if (code !== 0 && stdoutText.length === 0) {
        clearTimeout(timeout);
        rejectPromise(new Error(`MCP process exited with code ${code}. stderr: ${stderrChunks.join("")}`));
      }
    });
  });

  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 })}\n`);

  return responsePromise;
}

before(async () => {
  rmSync(clawpayDir, { recursive: true, force: true });
  configModule = await import("../src/config.js");
  guardrailsModule = await import("../src/guardrails.js");
  paypalModule = await import("../src/paypal.js");
});

after(() => {
  rmSync(testHome, { recursive: true, force: true });
});

describe("Config module and guardrails integration", () => {
  it("loadConfig returns defaults when no config file exists", () => {
    const configFile = join(clawpayDir, "config.json");
    rmSync(configFile, { force: true });

    const config = configModule.loadConfig();

    assert.strictEqual(config.guardrails.maxAmountPerTransactionCents, 10000);
    assert.strictEqual(config.guardrails.maxDailySpendCents, 50000);
    assert.ok(config.guardrails.allowedCurrencies.includes("usd"));
  });

  it("checkGuardrails blocks amount over per-transaction limit", () => {
    const result = configModule.checkGuardrails(15000, "usd");

    assert.strictEqual(result.allowed, false);
    assert.match(result.reason ?? "", /exceeds/i);
  });

  it("checkGuardrails allows valid amount", () => {
    const result = configModule.checkGuardrails(500, "usd");

    assert.strictEqual(result.allowed, true);
  });

  it("checkGuardrails blocks disallowed currency", () => {
    const result = configModule.checkGuardrails(100, "eur");

    assert.strictEqual(result.allowed, false);
    assert.match(result.reason ?? "", /currency/i);
  });
});

describe("Config persistence", () => {
  it("saveConfig writes and loadConfig reads back", () => {
    const config = configModule.loadConfig();
    config.stripe.customerId = "cus_test123";
    config.stripe.paymentMethodId = "pm_test456";
    configModule.saveConfig(config);

    const loaded = configModule.loadConfig();
    assert.strictEqual(loaded.stripe.customerId, "cus_test123");
    assert.strictEqual(loaded.stripe.paymentMethodId, "pm_test456");
    assert.strictEqual(loaded.guardrails.maxAmountPerTransactionCents, 10000);
  });

  it("loadConfig returns defaults when config file contains invalid JSON", () => {
    const configFile = join(clawpayDir, "config.json");
    writeFileSync(configFile, "NOT_VALID_JSON{{{", "utf-8");

    const config = configModule.loadConfig();
    assert.strictEqual(config.guardrails.maxAmountPerTransactionCents, 10000);
    assert.strictEqual(config.guardrails.maxDailySpendCents, 50000);
  });

  it("isConfigured returns true when customerId and paymentMethodId are set", () => {
    const config = configModule.loadConfig();
    config.stripe.customerId = "cus_test123";
    config.stripe.paymentMethodId = "pm_test456";
    configModule.saveConfig(config);

    assert.strictEqual(configModule.isConfigured(), true);
  });

  it("isConfigured returns false when payment method is missing", () => {
    const config = configModule.loadConfig();
    config.stripe.customerId = undefined;
    config.stripe.paymentMethodId = undefined;
    configModule.saveConfig(config);

    assert.strictEqual(configModule.isConfigured(), false);
  });
});

describe("Daily spend tracking", () => {
  it("recordSpend and getDailySpend track spending", () => {
    const before = configModule.getDailySpend();
    configModule.recordSpend(2500);
    const after = configModule.getDailySpend();
    assert.strictEqual(after, before + 2500);
  });

  it("getDailySpend returns 0 when spend log is corrupt", () => {
    const today = new Date().toISOString().slice(0, 10);
    const spendFile = join(clawpayDir, `spend-${today}.json`);
    writeFileSync(spendFile, "CORRUPT", "utf-8");

    const spend = configModule.getDailySpend();
    assert.strictEqual(spend, 0);

    rmSync(spendFile, { force: true });
  });

  it("checkGuardrails blocks zero amount", () => {
    const result = configModule.checkGuardrails(0, "usd");
    assert.strictEqual(result.allowed, false);
    assert.match(result.reason ?? "", /greater than zero/i);
  });

  it("checkGuardrails blocks when daily limit would be exceeded", () => {
    // Record enough spend to approach the daily limit
    configModule.recordSpend(45000);
    const result = configModule.checkGuardrails(8000, "usd");
    assert.strictEqual(result.allowed, false);
    assert.match(result.reason ?? "", /daily/i);
  });
});

describe("Audit log integration", () => {
  it("auditLog creates directory if missing", () => {
    rmSync(clawpayDir, { recursive: true, force: true });

    guardrailsModule.auditPayment({ amount: 100, currency: "usd", status: "success" });

    const auditFile = join(clawpayDir, "audit.log");
    assert.ok(existsSync(auditFile));
  });

  it("auditPayment writes to audit log without sensitive data", () => {
    guardrailsModule.auditPayment({ amount: 1000, currency: "usd", status: "success" });

    const auditFile = join(clawpayDir, "audit.log");
    assert.ok(existsSync(auditFile));

    const lines = readFileSync(auditFile, "utf8").trim().split("\n");
    const lastLine = lines[lines.length - 1];
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(lastLine) as Record<string, unknown>;
    } catch {
      assert.fail("Last audit line is not valid JSON.");
    }

    assert.ok(typeof parsed["timestamp"] === "string");
    assert.strictEqual(parsed["action"], "pay");
    assert.strictEqual(parsed["amount"], 1000);
    assert.strictEqual(parsed["currency"], "usd");
    assert.strictEqual(parsed["status"], "success");

    const serialized = JSON.stringify(parsed);
    assert.strictEqual(serialized.includes("sk_"), false);
    assert.strictEqual(serialized.includes("4242"), false);
  });

  it("auditRefund writes refund entry to audit log", () => {
    guardrailsModule.auditRefund({ refundId: "re_test789", amount: 500, status: "success" });

    const auditFile = join(clawpayDir, "audit.log");
    const lines = readFileSync(auditFile, "utf8").trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine) as Record<string, unknown>;

    assert.strictEqual(parsed["action"], "refund");
    assert.strictEqual(parsed["refundId"], "re_test789");
    assert.strictEqual(parsed["amount"], 500);
    assert.strictEqual(parsed["status"], "success");
  });

  it("auditSetup writes setup entry to audit log", () => {
    guardrailsModule.auditSetup("failed", "User cancelled");

    const auditFile = join(clawpayDir, "audit.log");
    const lines = readFileSync(auditFile, "utf8").trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine) as Record<string, unknown>;

    assert.strictEqual(parsed["action"], "setup_payment");
    assert.strictEqual(parsed["status"], "failed");
    assert.strictEqual(parsed["reason"], "User cancelled");
  });
});

describe("MCP server smoke test", () => {
  before(() => {
    const build = spawnSync("npx", ["tsc"], {
      cwd: projectRoot,
      encoding: "utf8",
      env: process.env,
    });
    assert.strictEqual(build.status, 0, `TypeScript build failed: ${build.stderr || build.stdout}`);
  });

  it("MCP tools/list returns all seven tools", async () => {
    const tools = await requestToolsList();

    assert.strictEqual(tools.length, 7);
    const names = tools
      .map((tool) => (typeof tool === "object" && tool !== null ? (tool as { name?: unknown }).name : undefined))
      .filter((name): name is string => typeof name === "string");

    assert.ok(names.includes("setup_payment"));
    assert.ok(names.includes("pay"));
    assert.ok(names.includes("get_balance"));
    assert.ok(names.includes("list_transactions"));
    assert.ok(names.includes("refund"));
    assert.ok(names.includes("setup_paypal"));
    assert.ok(names.includes("send_paypal"));
  });
});

describe("PayPal config", () => {
  it("isPayPalConfigured returns false when no PayPal config", () => {
    const config = configModule.loadConfig();
    config.paypal = { environment: "sandbox" };
    configModule.saveConfig(config);

    assert.strictEqual(configModule.isPayPalConfigured(), false);
  });

  it("isPayPalConfigured returns true when clientId and clientSecret are set", () => {
    const config = configModule.loadConfig();
    config.paypal = { clientId: "fake_id", clientSecret: "fake_secret", environment: "sandbox" };
    configModule.saveConfig(config);

    assert.strictEqual(configModule.isPayPalConfigured(), true);

    const clean = configModule.loadConfig();
    clean.paypal = { environment: "sandbox" };
    configModule.saveConfig(clean);
  });

  it("loadConfig applies PAYPAL_ENVIRONMENT=production override", () => {
    process.env.PAYPAL_ENVIRONMENT = "production";
    const config = configModule.loadConfig();
    assert.strictEqual(config.paypal?.environment, "production");
    delete process.env.PAYPAL_ENVIRONMENT;
  });
});

describe("PayPal audit logging", () => {
  it("auditPayPalSend with email writes masked email to audit log", () => {
    guardrailsModule.auditPayPalSend({
      amount: 2000,
      currency: "usd",
      recipientEmail: "john@example.com",
      status: "success",
      payoutBatchId: "BATCH_TEST_1",
    });

    const auditFile = join(clawpayDir, "audit.log");
    const lines = readFileSync(auditFile, "utf8").trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine) as Record<string, unknown>;

    assert.strictEqual(parsed["action"], "paypal_send");
    assert.strictEqual(parsed["amount"], 2000);
    assert.strictEqual(parsed["status"], "success");
    assert.ok(typeof parsed["recipientMasked"] === "string");
    assert.ok((parsed["recipientMasked"] as string).includes("@"));
    assert.ok((parsed["recipientMasked"] as string).includes("***"));
  });

  it("auditPayPalSend with phone writes masked phone to audit log", () => {
    guardrailsModule.auditPayPalSend({
      amount: 1000,
      currency: "usd",
      recipientPhone: "+12345678901",
      status: "success",
    });

    const auditFile = join(clawpayDir, "audit.log");
    const lines = readFileSync(auditFile, "utf8").trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine) as Record<string, unknown>;

    assert.strictEqual(parsed["action"], "paypal_send");
    assert.ok(typeof parsed["recipientMasked"] === "string");
    assert.ok((parsed["recipientMasked"] as string).includes("***"));
  });

  it("auditPayPalSetup writes setup entry to audit log", () => {
    guardrailsModule.auditPayPalSetup("success");

    const auditFile = join(clawpayDir, "audit.log");
    const lines = readFileSync(auditFile, "utf8").trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine) as Record<string, unknown>;

    assert.strictEqual(parsed["action"], "setup_paypal");
    assert.strictEqual(parsed["status"], "success");
  });

  it("auditPayPalSend with no recipient writes undefined recipientMasked", () => {
    guardrailsModule.auditPayPalSend({
      amount: 500,
      currency: "usd",
      status: "blocked",
      reason: "test",
    });

    const auditFile = join(clawpayDir, "audit.log");
    const lines = readFileSync(auditFile, "utf8").trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine) as Record<string, unknown>;

    assert.strictEqual(parsed["action"], "paypal_send");
    assert.strictEqual(parsed["recipientMasked"], undefined);
  });
});

describe("PayPal sendMoney", () => {
  before(() => {
    process.env.PAYPAL_CLIENT_ID = "fake_paypal_client_id";
    process.env.PAYPAL_CLIENT_SECRET = "fake_paypal_client_secret";
  });

  after(() => {
    mock.restoreAll();
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  it("sendMoney blocked by guardrails when amount exceeds per-transaction limit", async () => {
    const result = await paypalModule.sendMoney({
      recipientEmail: "test@example.com",
      amountCents: 15000,
      currency: "usd",
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error !== undefined);
  });

  it("sendMoney returns error when neither recipientEmail nor recipientPhone provided", async () => {
    const result = await paypalModule.sendMoney({
      amountCents: 500,
      currency: "usd",
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes("recipientEmail") || result.error?.includes("recipientPhone"));
  });

  it("getAccessToken throws when credentials are missing", async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;

    const config = configModule.loadConfig();
    config.paypal = { environment: "sandbox" };
    configModule.saveConfig(config);

    await assert.rejects(
      () => paypalModule.getAccessToken(),
      /credentials not configured/i
    );

    process.env.PAYPAL_CLIENT_ID = "fake_paypal_client_id";
    process.env.PAYPAL_CLIENT_SECRET = "fake_paypal_client_secret";
  });

  it("verifyPayPalConnection returns false when credentials are missing", async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;

    const config = configModule.loadConfig();
    config.paypal = { environment: "sandbox" };
    configModule.saveConfig(config);

    const result = await paypalModule.verifyPayPalConnection();
    assert.strictEqual(result, false);

    process.env.PAYPAL_CLIENT_ID = "fake_paypal_client_id";
    process.env.PAYPAL_CLIENT_SECRET = "fake_paypal_client_secret";
  });

  it("getAccessToken throws when OAuth fetch fails", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    }));

    await assert.rejects(
      () => paypalModule.getAccessToken(),
      /PayPal OAuth failed/i
    );
    mock.restoreAll();
  });

  it("sendMoney returns error when PayPal API returns non-ok response", async () => {
    mock.method(globalThis, "fetch", async (url: string) => {
      if ((url as string).includes("/oauth2/token")) {
        return {
          ok: true,
          json: async () => ({ access_token: "fake_token_err", expires_in: 1 }),
        };
      }
      return {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "Invalid request",
      };
    });

    const result = await paypalModule.sendMoney({
      recipientEmail: "test@example.com",
      amountCents: 500,
      currency: "usd",
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error !== undefined);
    mock.restoreAll();
  });

  it("sendMoney returns success with payoutBatchId on valid request", async () => {
    mock.method(globalThis, "fetch", async (url: string) => {
      if ((url as string).includes("/oauth2/token")) {
        return {
          ok: true,
          json: async () => ({ access_token: "fake_token_ok", expires_in: 1 }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          batch_header: { payout_batch_id: "BATCH123", batch_status: "PENDING" },
        }),
      };
    });

    const result = await paypalModule.sendMoney({
      recipientEmail: "recipient@example.com",
      amountCents: 500,
      currency: "usd",
      note: "Test payment",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.payoutBatchId, "BATCH123");
    assert.strictEqual(result.status, "PENDING");
    mock.restoreAll();
  });

  it("getAccessToken returns cached token when cache is still valid", async () => {
    mock.method(globalThis, "fetch", async (url: string) => {
      if ((url as string).includes("/oauth2/token")) {
        return {
          ok: true,
          json: async () => ({ access_token: "cached_token_3600", expires_in: 3600 }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const first = await paypalModule.getAccessToken();
    const second = await paypalModule.getAccessToken();
    assert.strictEqual(first, second);
    mock.restoreAll();
  });

  it("sendMoney returns error when fetch throws an exception", async () => {
    mock.method(globalThis, "fetch", async (url: string) => {
      if ((url as string).includes("/oauth2/token")) {
        return {
          ok: true,
          json: async () => ({ access_token: "fake_token_throw", expires_in: 1 }),
        };
      }
      throw new Error("Network failure");
    });

    const result = await paypalModule.sendMoney({
      recipientEmail: "test@example.com",
      amountCents: 500,
      currency: "usd",
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes("Network failure"));
    mock.restoreAll();
  });
});

describe("Security scan", () => {
  it("source files do not contain hardcoded sensitive patterns", () => {
    const srcDir = join(projectRoot, "src");
    const tsFiles = collectTsFiles(srcDir);

    for (const filePath of tsFiles) {
      const content = readFileSync(filePath, "utf8");
      assert.strictEqual(content.includes("4242"), false, `Found banned test card pattern in ${filePath}`);
      assert.strictEqual(content.includes("pm_card_visa"), false, `Found banned test payment method in ${filePath}`);
      assert.strictEqual(/sk_test_[a-zA-Z0-9]{20,}/.test(content), false, `Found hardcoded Stripe key in ${filePath}`);
      assert.strictEqual(content.includes("eval("), false, `Found eval usage in ${filePath}`);
    }
  });
});
