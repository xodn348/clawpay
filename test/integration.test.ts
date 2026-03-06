import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const testHome = mkdtempSync(join(tmpdir(), "clawpay-integration-"));
const clawpayDir = join(testHome, ".clawpay");

process.env.HOME = testHome;
process.env.USERPROFILE = testHome;

type ConfigModule = typeof import("../src/config.js");
type GuardrailsModule = typeof import("../src/guardrails.js");

let configModule: ConfigModule;
let guardrailsModule: GuardrailsModule;

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

describe("Audit log integration", () => {
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

  it("MCP tools/list returns all five tools", async () => {
    const tools = await requestToolsList();

    assert.strictEqual(tools.length, 5);
    const names = tools
      .map((tool) => (typeof tool === "object" && tool !== null ? (tool as { name?: unknown }).name : undefined))
      .filter((name): name is string => typeof name === "string");

    assert.ok(names.includes("setup_payment"));
    assert.ok(names.includes("pay"));
    assert.ok(names.includes("get_balance"));
    assert.ok(names.includes("list_transactions"));
    assert.ok(names.includes("refund"));
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
