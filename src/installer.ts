import { createInterface } from "node:readline";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

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

async function readJsonSafe(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

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
  }

  console.log('\nInstallation complete! Ask your AI: "set up payment method"');
}

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
