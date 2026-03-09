#!/usr/bin/env node

import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { isConfigured } from "./config.js";
import { createPayment, getBalance, listTransactions, refundPayment } from "./stripe.js";
import { sendMoney } from "./paypal.js";

type JsonObject = Record<string, unknown>;
type InstallerAction = "install" | "uninstall";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: string };
const VERSION = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";

function successResult(result: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}

function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" ? (value as JsonObject) : {};
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid or missing '${field}'.`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid or missing '${field}'.`);
  }
  return value;
}

function optionalPositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid '${field}'. Expected a positive integer.`);
  }
  return value;
}

async function getRunSetup(): Promise<() => Promise<unknown>> {
  const setupModule = (await import("./setup.js")) as JsonObject;
  const runSetup = setupModule["runSetup"];
  if (typeof runSetup !== "function") {
    throw new Error("setup_payment is not available: runSetup() is not implemented in ./setup.js.");
  }
  return runSetup as () => Promise<unknown>;
}

async function getRunPayPalSetup(): Promise<() => Promise<{ success: boolean; message: string }>> {
  const setupModule = (await import("./setup-paypal.js")) as JsonObject;
  const runPayPalSetup = setupModule["runPayPalSetup"];
  if (typeof runPayPalSetup !== "function") {
    throw new Error("setup_paypal is not available: runPayPalSetup() is not implemented in ./setup-paypal.js.");
  }
  return runPayPalSetup as () => Promise<{ success: boolean; message: string }>;
}

async function getRunLithicSetup(): Promise<() => Promise<{ success: boolean; message: string }>> {
  const setupModule = (await import("./setup-lithic.js")) as JsonObject;
  const runLithicSetup = setupModule["runLithicSetup"];
  if (typeof runLithicSetup !== "function") {
    throw new Error("setup_lithic is not available: runLithicSetup() is not implemented in ./setup-lithic.js.");
  }
  return runLithicSetup as () => Promise<{ success: boolean; message: string }>;
}

async function runInstallerAction(action: InstallerAction): Promise<void> {
  const installerModule = (await import("./installer.js")) as JsonObject;
  const candidates =
    action === "install"
      ? ["install", "runInstall", "runInstaller", "setup", "default"]
      : ["uninstall", "runUninstall", "remove", "teardown", "default"];

  for (const candidate of candidates) {
    const fn = installerModule[candidate];
    if (typeof fn === "function") {
      await Promise.resolve(fn());
      return;
    }
  }

  throw new Error(`'${action}' is not available: missing function export in ./installer.js.`);
}

async function runServer(): Promise<void> {
  if (!process.env["STRIPE_SECRET_KEY"] && !process.env["LITHIC_API_KEY"]) {
    console.error("At least one of STRIPE_SECRET_KEY or LITHIC_API_KEY environment variable is required.");
    process.exit(1);
  }

  const server = new Server(
    { name: "clawpay", version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "setup_payment",
        description: "Set up Stripe payment method for ClawPay.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "pay",
        description: "Create and confirm a payment in cents.",
        inputSchema: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Amount in cents." },
            currency: { type: "string", description: "Currency code (for example: usd)." },
            description: { type: "string", description: "Payment description." },
          },
          required: ["amount", "currency", "description"],
          additionalProperties: false,
        },
      },
      {
        name: "get_balance",
        description: "Get Stripe account balance.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "list_transactions",
        description: "List recent payment transactions.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Optional max items to return.",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "refund",
        description: "Refund a payment intent.",
        inputSchema: {
          type: "object",
          properties: {
            payment_intent_id: { type: "string", description: "Stripe payment intent ID." },
          },
          required: ["payment_intent_id"],
          additionalProperties: false,
        },
      },
      {
        name: "setup_paypal",
        description: "Link PayPal account using Client ID and Client Secret. Reads credentials from PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables or config file.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "send_paypal",
        description: "Send money via PayPal Payouts to an email address or phone number.",
        inputSchema: {
          type: "object",
          properties: {
            recipientEmail: { type: "string", description: "PayPal email address of recipient." },
            recipientPhone: { type: "string", description: "Phone number of recipient in E.164 format." },
            amount: { type: "number", description: "Amount in cents (e.g. 2000 for $20.00)." },
            currency: { type: "string", description: "ISO 4217 currency code (default: usd)." },
            note: { type: "string", description: "Optional note to recipient." },
          },
          required: ["amount"],
          additionalProperties: false,
        },
      },
      {
        name: "setup_lithic",
        description: "Set up Lithic virtual card API for AI shopping. Reads LITHIC_API_KEY from environment.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "browse_and_buy",
        description: "Browse an online store, add items to cart, and complete purchase using a Lithic virtual card. Requires Playwright installed.",
        inputSchema: {
          type: "object",
          properties: {
            store_url: { type: "string", description: "URL of the store (currently supports automationexercise.com)" },
            product_query: { type: "string", description: "Product to search for and buy" },
          },
          required: ["store_url", "product_query"],
          additionalProperties: false,
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = asObject(request.params.arguments);

    switch (name) {
      case "setup_payment": {
        try {
          const runSetup = await getRunSetup();
          const result = await runSetup();
          return successResult({ result, configured: isConfigured() });
        } catch (error) {
          return errorResult(error);
        }
      }

      case "pay": {
        try {
          const amount = requireNumber(args["amount"], "amount");
          const currency = requireString(args["currency"], "currency");
          const description = requireString(args["description"], "description");
          const result = await createPayment({ amount, currency, description });
          return successResult(result);
        } catch (error) {
          return errorResult(error);
        }
      }

      case "get_balance": {
        try {
          const result = await getBalance();
          return successResult(result);
        } catch (error) {
          return errorResult(error);
        }
      }

      case "list_transactions": {
        try {
          const limit = optionalPositiveInt(args["limit"], "limit");
          const result = await listTransactions(limit);
          return successResult(result);
        } catch (error) {
          return errorResult(error);
        }
      }

      case "refund": {
        try {
          const paymentIntentId = requireString(args["payment_intent_id"], "payment_intent_id");
          const result = await refundPayment(paymentIntentId);
          return successResult(result);
        } catch (error) {
          return errorResult(error);
        }
      }

      case "setup_paypal": {
        try {
          const runPayPalSetup = await getRunPayPalSetup();
          const result = await runPayPalSetup();
          return successResult(result);
        } catch (error) {
          return errorResult(error);
        }
      }

      case "send_paypal": {
        try {
          const recipientEmail = typeof args["recipientEmail"] === "string" ? args["recipientEmail"] : undefined;
          const recipientPhone = typeof args["recipientPhone"] === "string" ? args["recipientPhone"] : undefined;
          if (!recipientEmail && !recipientPhone) {
            return errorResult(new Error("Either recipientEmail or recipientPhone is required."));
          }
          const amount = requireNumber(args["amount"], "amount");
          const currency = typeof args["currency"] === "string" ? args["currency"] : "usd";
          const note = typeof args["note"] === "string" ? args["note"] : undefined;
          const result = await sendMoney({ recipientEmail, recipientPhone, amountCents: amount, currency, note });
          return successResult(result);
        } catch (error) {
          return errorResult(error);
        }
      }

      case "setup_lithic": {
        try {
          const runLithicSetup = await getRunLithicSetup();
          const result = await runLithicSetup();
          return successResult(result);
        } catch (error) {
          return errorResult(error);
        }
      }

      case "browse_and_buy": {
        try {
          const { isLithicConfigured } = await import("./config.js");
          if (!isLithicConfigured()) {
            return errorResult(new Error("Lithic not configured. Run setup_lithic first."));
          }
          const storeUrl = requireString(args["store_url"], "store_url");
          const productQuery = requireString(args["product_query"], "product_query");

          const { createSingleUseCard, getCardDetails, closeCard } = await import("./lithic.js");
          const { browseAndBuy } = await import("./shopping.js");

          // Create card (guardrails check happens inside createSingleUseCard)
          const SHOPPING_SPEND_LIMIT_CENTS = 10000;
          const card = await createSingleUseCard(SHOPPING_SPEND_LIMIT_CENTS);
          let cardDetails: Awaited<ReturnType<typeof getCardDetails>> | undefined;

          try {
            cardDetails = await getCardDetails(card.token);

            const result = await browseAndBuy({
              storeUrl,
              productQuery,
              cardDetails: {
                pan: cardDetails.pan,
                cvv: cardDetails.cvv,
                expMonth: cardDetails.expMonth,
                expYear: cardDetails.expYear,
              },
              onConfirmation: async (summary: string) => {
                try {
                  const elicitResult = await server.elicitInput({
                    message: summary,
                    requestedSchema: {
                      type: "object" as const,
                      properties: {
                        confirm: {
                          type: "boolean" as const,
                          title: "Confirm Purchase",
                          description: "Do you want to proceed with this purchase?",
                        },
                      },
                      required: ["confirm"],
                    },
                  });
                  if (elicitResult.action === "accept" && elicitResult.content?.confirm === true) {
                    return true;
                  }
                  return false;
                } catch {
                  // Client doesn't support elicitation — abort for safety
                  return false;
                }
              },
            });

            // Don't include PAN/CVV in result
            return successResult({
              success: result.success,
              orderId: result.orderId,
              totalCents: result.totalCents,
              productName: result.productName,
              message: result.message,
              cancelled: result.cancelled,
            });
          } finally {
            // Always close the card
            await closeCard(card.token).catch(() => {});
          }
        } catch (error) {
          return errorResult(error);
        }
      }

      default:
        return errorResult(new Error(`Unknown tool: ${name}`));
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "install") {
    await runInstallerAction("install");
    return;
  }

  if (command === "uninstall") {
    await runInstallerAction("uninstall");
    return;
  }

  if (command !== undefined) {
    console.error(`Unknown command: ${command}`);
    console.error("Usage: clawpay [install|uninstall]");
    process.exitCode = 1;
    return;
  }

  await runServer();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
