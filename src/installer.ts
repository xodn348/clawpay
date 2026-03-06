import { createInterface } from "node:readline";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

interface McpClientConfig {
  name: string;
  configPath: string;
  mcpKey: "mcp" | "mcpServers";
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/* c8 ignore start */
async function readJsonSafe(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}
/* c8 ignore end */

/* c8 ignore start */
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
/* c8 ignore end */

/* c8 ignore start */
function getMcpClients(): McpClientConfig[] {
  const home = homedir();
  return [
    {
      name: "OpenCode",
      configPath: join(home, ".config", "opencode", "config.json"),
      mcpKey: "mcp",
    },
    {
      name: "Claude Desktop (macOS)",
      configPath: join(
        home,
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      ),
      mcpKey: "mcpServers",
    },
    {
      name: "Claude Desktop (Linux)",
      configPath: join(home, ".config", "Claude", "claude_desktop_config.json"),
      mcpKey: "mcpServers",
    },
    {
      name: "Cursor",
      configPath: join(home, ".cursor", "mcp.json"),
      mcpKey: "mcpServers",
    },
  ];
}
/* c8 ignore end */

/* c8 ignore start */
function buildClawPayEntry(
  stripeKey: string,
  mcpKey: "mcp" | "mcpServers",
  paypalClientId?: string,
  paypalClientSecret?: string
): Record<string, unknown> {
  if (mcpKey === "mcp") {
    const environment: Record<string, string> = {
      STRIPE_SECRET_KEY: stripeKey,
    };
    if (paypalClientId) environment["PAYPAL_CLIENT_ID"] = paypalClientId;
    if (paypalClientSecret) environment["PAYPAL_CLIENT_SECRET"] = paypalClientSecret;
    return {
      clawpay: {
        type: "local",
        command: ["clawpay"],
        environment,
      },
    };
  }
  const env: Record<string, string> = {
    STRIPE_SECRET_KEY: stripeKey,
  };
  if (paypalClientId) env["PAYPAL_CLIENT_ID"] = paypalClientId;
  if (paypalClientSecret) env["PAYPAL_CLIENT_SECRET"] = paypalClientSecret;
  return {
    clawpay: {
      command: "clawpay",
      args: [],
      env,
    },
  };
}
/* c8 ignore end */

const SKILL_MD_CONTENT = `---
name: clawpay
description: Make payments with ClawPay via Stripe and PayPal. Use when user wants to pay, send money, charge, refund, check balance, view transactions, set up payment method, or configure PayPal. Triggers: pay, send money, charge, refund, balance, transactions, set up payment, set up paypal, google pay, apple pay, alipay.
homepage: https://github.com/xodn348/clawpay
metadata: {"openclaw":{"emoji":"💳","requires":{"bins":["mcporter","clawpay"]},"install":[{"id":"node","kind":"node","package":"@xodn348/clawpay","bins":["clawpay"],"label":"Install ClawPay (npm)"}]}}
---

# ClawPay — Stripe + PayPal Payments

Make real payments via Stripe and PayPal using mcporter bridge.

## Safety Rules

- **Never auto-confirm payments without explicit user approval.** Always preview first; ask for confirmation.
- **Guardrails enforced:** $100 max per transaction, $500 max per day, USD only.
- **Audit trail:** Every action logged to \`~/.clawpay/audit.log\`.

## Setup (once)

\`\`\`bash
mcporter call --stdio "clawpay" setup_payment
mcporter call --stdio "clawpay" setup_paypal
\`\`\`

## Stripe Payments

**Create payment:**
\`\`\`bash
mcporter call --stdio "clawpay" pay amount=1000 currency=usd description="Coffee"
\`\`\`

**Check balance:**
\`\`\`bash
mcporter call --stdio "clawpay" get_balance
\`\`\`

**List transactions:**
\`\`\`bash
mcporter call --stdio "clawpay" list_transactions limit=5
\`\`\`

**Refund payment:**
\`\`\`bash
mcporter call --stdio "clawpay" refund payment_intent_id=pi_xxx
\`\`\`

## PayPal Payouts

**Send money via PayPal:**
\`\`\`bash
mcporter call --stdio "clawpay" send_paypal recipientEmail=friend@example.com amount=2000 note="Lunch"
\`\`\`

Or by phone:
\`\`\`bash
mcporter call --stdio "clawpay" send_paypal recipientPhone=+12025551234 amount=2000
\`\`\`

## Notes

- Amounts in cents: \`1000\` = $10.00
- Currency default: \`usd\`
- PayPal requires either \`recipientEmail\` or \`recipientPhone\`
- All transactions logged with timestamps and status`;

export async function installClaudeCode(
  stripeKey: string,
  paypalClientId?: string,
  paypalClientSecret?: string
): Promise<boolean> {
  const whichResult = spawnSync("which", ["claude"], { encoding: "utf-8" });
  if (whichResult.status !== 0) {
    return false;
  }

  const args = [
    "mcp", "add", "-s", "user",
    "clawpay",
    "-e", `STRIPE_SECRET_KEY=${stripeKey}`,
  ];
  if (paypalClientId) {
    args.push("-e", `PAYPAL_CLIENT_ID=${paypalClientId}`);
  }
  if (paypalClientSecret) {
    args.push("-e", `PAYPAL_CLIENT_SECRET=${paypalClientSecret}`);
  }
  args.push("--", "clawpay");

  try {
    const result = spawnSync("claude", args, { encoding: "utf-8" });
    if (result.status !== 0) {
      const errMsg = (result.stderr as string) || "Unknown error";
      console.log(`  Warning: Claude Code configuration failed: ${errMsg.trim()}`);
      return false;
    }
    console.log("  ✓ Claude Code configured");
    return true;
  } /* c8 ignore start */ catch (error) {
    console.log(`  Warning: Claude Code configuration failed: ${String(error)}`);
    return false;
  } /* c8 ignore end */
}

export async function installOpenClaw(): Promise<boolean> {
  const home = homedir();
  const openClawDir = join(home, ".openclaw");

  if (!(await isDirectory(openClawDir))) {
    return false;
  }

  const skillDir = join(openClawDir, "workspace", "skills", "clawpay");
  const skillFile = join(skillDir, "SKILL.md");

  if (await pathExists(skillFile)) {
    console.log("  clawpay skill already installed in OpenClaw — skipping");
    return true;
  }

  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(skillFile, SKILL_MD_CONTENT, "utf-8");
  console.log("  ✓ OpenClaw skill installed");
  return true;
}

/* c8 ignore start */
export async function runInstall(): Promise<void> {
  const stripeKey = await askQuestion(
    "Enter your Stripe Secret Key (sk_test_... or sk_live_...): "
  );

  if (!stripeKey.startsWith("sk_test_") && !stripeKey.startsWith("sk_live_")) {
    console.error(
      "Error: Invalid Stripe key. Must start with sk_test_ or sk_live_."
    );
    process.exit(1);
  }

  // Never log the full key — show a masked version only
  const maskedKey = `sk_...${stripeKey.slice(-4)}`;
  console.log(`\nConfiguring MCP clients with key ${maskedKey}...`);

  let paypalClientId: string | undefined;
  let paypalClientSecret: string | undefined;

  const configurePaypal = await askQuestion(
    "\nDo you want to configure PayPal? (y/N): "
  );
  if (configurePaypal === "y" || configurePaypal === "Y") {
    paypalClientId = await askQuestion("Enter your PayPal Client ID: ");
    paypalClientSecret = await askQuestion(
      "Enter your PayPal Client Secret: "
    );
    const maskedPaypalId = `${paypalClientId.slice(0, 8)}...`;
    console.log(`  PayPal Client ID: ${maskedPaypalId}`);
  }

  const clients = getMcpClients();
  let configuredCount = 0;

  for (const client of clients) {
    const configDir = dirname(client.configPath);
    const configFileExists = await pathExists(client.configPath);
    const configDirExists = await isDirectory(configDir);

    if (!configFileExists && !configDirExists) {
      continue;
    }

    const config = await readJsonSafe(client.configPath);
    const mcpSection =
      (config[client.mcpKey] as Record<string, unknown> | undefined) ?? {};

    if (mcpSection["clawpay"] !== undefined) {
      console.log(
        `  clawpay already configured in ${client.name} — skipping`
      );
      configuredCount++;
      continue;
    }

    const entry = buildClawPayEntry(stripeKey, client.mcpKey, paypalClientId, paypalClientSecret);
    config[client.mcpKey] = { ...mcpSection, ...entry };

    await fs.writeFile(
      client.configPath,
      JSON.stringify(config, null, 2),
      "utf-8"
    );
    console.log(`  ✓ ${client.name} configured`);
    configuredCount++;
  }

  const claudeCodeInstalled = await installClaudeCode(stripeKey, paypalClientId, paypalClientSecret);
  if (claudeCodeInstalled) configuredCount++;

  const openClawInstalled = await installOpenClaw();
  if (openClawInstalled) configuredCount++;

  if (configuredCount === 0) {
    console.log(
      "\nNo MCP client config files found. Add clawpay manually:"
    );

    const openCodeEnv: Record<string, string> = { STRIPE_SECRET_KEY: maskedKey };
    if (paypalClientId) openCodeEnv["PAYPAL_CLIENT_ID"] = paypalClientId;
    if (paypalClientSecret) openCodeEnv["PAYPAL_CLIENT_SECRET"] = paypalClientSecret;

    const desktopEnv: Record<string, string> = { STRIPE_SECRET_KEY: maskedKey };
    if (paypalClientId) desktopEnv["PAYPAL_CLIENT_ID"] = paypalClientId;
    if (paypalClientSecret) desktopEnv["PAYPAL_CLIENT_SECRET"] = paypalClientSecret;

    console.log("\nOpenCode (~/.config/opencode/config.json):");
    console.log(
      JSON.stringify(
        {
          mcp: {
            clawpay: {
              type: "local",
              command: ["clawpay"],
              environment: openCodeEnv,
            },
          },
        },
        null,
        2
      )
    );
    console.log(
      "\nClaude Desktop (~/.../claude_desktop_config.json) / Cursor (~/.cursor/mcp.json):"
    );
    console.log(
      JSON.stringify(
        {
          mcpServers: {
            clawpay: {
              command: "clawpay",
              args: [],
              env: desktopEnv,
            },
          },
        },
        null,
        2
      )
    );

    let claudeCodeCmd = `claude mcp add -s user clawpay -e STRIPE_SECRET_KEY=${maskedKey}`;
    if (paypalClientId) claudeCodeCmd += ` -e PAYPAL_CLIENT_ID=${paypalClientId}`;
    if (paypalClientSecret) claudeCodeCmd += ` -e PAYPAL_CLIENT_SECRET=${paypalClientSecret}`;
    claudeCodeCmd += " -- clawpay";
    console.log("\nClaude Code (run in terminal):");
    console.log(`  ${claudeCodeCmd}`);

    console.log("\nOpenClaw:");
    console.log("  Create ~/.openclaw/workspace/skills/clawpay/SKILL.md");
    console.log("  (run: clawpay install after creating ~/.openclaw/ directory)");
  }

  console.log('\nInstallation complete! Ask your AI: "set up payment method"');
}
/* c8 ignore end */

/* c8 ignore start */
export async function runUninstall(): Promise<void> {
  const clients = getMcpClients();

  for (const client of clients) {
    const exists = await pathExists(client.configPath);

    if (!exists) {
      continue;
    }

    const config = await readJsonSafe(client.configPath);
    const mcpSection = config[client.mcpKey] as
      | Record<string, unknown>
      | undefined;

    if (mcpSection === undefined || mcpSection["clawpay"] === undefined) {
      console.log(`  ${client.name} — not configured, skipping`);
      continue;
    }

    const updated = { ...mcpSection };
    delete updated["clawpay"];
    config[client.mcpKey] = updated;

    await fs.writeFile(
      client.configPath,
      JSON.stringify(config, null, 2),
      "utf-8"
    );
    console.log(`  ✓ ${client.name} — clawpay removed`);
  }

  console.log("\nUninstallation complete.");
}
/* c8 ignore end */
