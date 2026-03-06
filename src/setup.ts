import http from "node:http";
import { exec } from "node:child_process";
import qrcode from "qrcode-terminal";
import { getStripe } from "./stripe.js";
import { loadConfig, saveConfig, isConfigured } from "./config.js";
import { auditSetup } from "./guardrails.js";

const SETUP_PORT = 3100;
const SETUP_HOST = "127.0.0.1";
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;
  if (platform === "darwin") {
    command = `open "${url}"`;
  } else if (platform === "win32") {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  exec(command, (err) => {
    if (err) {
      process.stderr.write(`Failed to open browser: ${err.message}\n`);
    }
  });
}

export async function runSetup(): Promise<{ success: boolean; message: string }> {
  if (isConfigured()) {
    return {
      success: true,
      message: "Payment method already configured. Run setup again to replace.",
    };
  }

  const stripe = getStripe();
  let checkoutUrl: string;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      payment_method_types: ["card"],
      success_url: `http://${SETUP_HOST}:${SETUP_PORT}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://${SETUP_HOST}:${SETUP_PORT}/cancel`,
    });
    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }
    checkoutUrl = session.url;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create Stripe Checkout Session.";
    auditSetup("failed", message);
    return { success: false, message };
  }

  return new Promise<{ success: boolean; message: string }>((resolve) => {
    let settled = false;

    const timeoutHandle = setTimeout(() => {
      finish({ success: false, message: "Setup timed out after 5 minutes." });
    }, TIMEOUT_MS);

    function finish(result: { success: boolean; message: string }): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      server.close();
      if (result.success) {
        auditSetup("success");
      } else {
        auditSetup("failed", result.message);
      }
      resolve(result);
    }

    const server = http.createServer((req, res) => {
      const rawUrl = req.url ?? "/";
      const parsedUrl = new URL(rawUrl, `http://${SETUP_HOST}:${SETUP_PORT}`);

      if (parsedUrl.pathname === "/success") {
        const sessionId = parsedUrl.searchParams.get("session_id");
        if (!sessionId) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing session_id parameter.");
          finish({ success: false, message: "Missing session_id in success callback." });
          return;
        }

        // Async work inside a synchronous request handler — explicitly void the promise.
        void (async () => {
          try {
            const completedSession = await stripe.checkout.sessions.retrieve(sessionId);

            // setup_intent is string | Stripe.SetupIntent | null depending on expansion.
            const rawSetupIntent = completedSession.setup_intent;
            const setupIntentId =
              typeof rawSetupIntent === "string"
                ? rawSetupIntent
                : (rawSetupIntent?.id ?? null);
            if (!setupIntentId) {
              throw new Error("No setup_intent on completed Checkout Session.");
            }

            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

            // payment_method is string | Stripe.PaymentMethod | null depending on expansion.
            const rawPaymentMethod = setupIntent.payment_method;
            const paymentMethodId =
              typeof rawPaymentMethod === "string"
                ? rawPaymentMethod
                : (rawPaymentMethod?.id ?? null);

            // customer is string | Stripe.Customer | Stripe.DeletedCustomer | null.
            const rawCustomer = setupIntent.customer;
            let customerId: string | null;
            if (typeof rawCustomer === "string") {
              customerId = rawCustomer;
            } else if (rawCustomer != null) {
              customerId = rawCustomer.id;
            } else {
              customerId = null;
            }

            if (!paymentMethodId) {
              throw new Error("No payment_method on SetupIntent.");
            }
            if (!customerId) {
              throw new Error("No customer on SetupIntent.");
            }

            // Never store raw card data — only Stripe IDs are persisted.
            const config = loadConfig();
            config.stripe.customerId = customerId;
            config.stripe.paymentMethodId = paymentMethodId;
            saveConfig(config);

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(
              "<!DOCTYPE html><html><body>" +
                "<h1>Payment method saved!</h1>" +
                "<p>You may close this tab and return to your terminal.</p>" +
                "</body></html>",
            );
            finish({ success: true, message: "Payment method configured successfully." });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Failed to save payment method.";
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end(message);
            finish({ success: false, message });
          }
        })();
      } else if (parsedUrl.pathname === "/cancel") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<!DOCTYPE html><html><body>" +
            "<h1>Setup cancelled.</h1>" +
            "<p>You may close this tab and return to your terminal.</p>" +
            "</body></html>",
        );
        finish({ success: false, message: "Setup was cancelled by the user." });
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found.");
      }
    });

    server.on("error", (err: Error) => {
      finish({ success: false, message: `Server error: ${err.message}` });
    });

    server.listen(SETUP_PORT, SETUP_HOST, () => {
      process.stderr.write(`Setup URL: ${checkoutUrl}\n`);
      qrcode.generate(checkoutUrl, { small: true });
      openBrowser(checkoutUrl);
    });
  });
}
