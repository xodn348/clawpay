import { exec } from "node:child_process";
import { checkGuardrails, recordSpend } from "./config.js";
import { auditShopping } from "./guardrails.js";
import type { ShoppingResult } from "./types.js";

const TEST_USER = {
  name: "ClawPay Test",
  email: "clawpay_test@test.com",
  password: "Test1234!",
};

const SHOPPING_TIMEOUT_MS = 5 * 60 * 1000;

type PlaywrightLoaderFn = () => Promise<{ chromium: { launch: (opts: { headless: boolean }) => Promise<unknown> } }>;

export const _shoppingState: { inProgress: boolean; playwrightLoader: PlaywrightLoaderFn } = {
  inProgress: false,
  playwrightLoader: async () => {
    try {
      return await import("playwright") as { chromium: { launch: (opts: { headless: boolean }) => Promise<unknown> } };
    } catch {
      throw new Error(
        "Playwright is required for shopping. Install it:\n" +
          "  npm install playwright && npx playwright install chromium",
      );
    }
  },
};

function openCartInBrowser(url: string): void {
  exec(`open "${url}"`, () => {});
}

function parsePriceToCents(priceText: string): number {
  const numeric = priceText.replace(/[^\d.]/g, "");
  const amount = Number.parseFloat(numeric);
  if (!Number.isFinite(amount)) {
    throw new Error(`Unable to parse cart total: ${priceText}`);
  }
  /* c8 ignore next */
  return numeric.includes(".") ? Math.round(amount * 100) : Math.round(amount * 100);
}

function extractOrderId(url: string): string {
  const match = url.match(/\/payment_done\/([^/?#]+)/);
  return match?.[1] ?? "unknown";
}

export async function browseAndBuy(opts: {
  storeUrl: string;
  productQuery: string;
  cardDetails: { pan: string; cvv: string; expMonth: string; expYear: string };
  onConfirmation?: (summary: string) => Promise<boolean>;
}): Promise<ShoppingResult> {
  if (_shoppingState.inProgress) {
    throw new Error("Another shopping session is in progress. Please wait.");
  }
  _shoppingState.inProgress = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any;
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const { chromium } = await _shoppingState.playwrightLoader();
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      void browser?.close().catch(() => {});
    }, SHOPPING_TIMEOUT_MS);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto("https://automationexercise.com/login", { waitUntil: "domcontentloaded" });
    await page.fill("input[data-qa='signup-name']", TEST_USER.name);
    await page.fill("input[data-qa='signup-email']", TEST_USER.email);
    await page.click("button[data-qa='signup-button']");

    const isRegistrationPage = (await page.locator("#id_gender1").count()) > 0;
    if (isRegistrationPage) {
      await page.check("#id_gender1");
      await page.fill("input[data-qa='password']", TEST_USER.password);
      await page.selectOption("select[data-qa='days']", "10");
      await page.selectOption("select[data-qa='months']", "10");
      await page.selectOption("select[data-qa='years']", "1998");
      await page.fill("input[data-qa='first_name']", "ClawPay");
      await page.fill("input[data-qa='last_name']", "Tester");
      await page.fill("input[data-qa='company']", "ClawPay");
      await page.fill("input[data-qa='address']", "123 Test Street");
      await page.fill("input[data-qa='address2']", "Suite 10");
      await page.selectOption("select[data-qa='country']", "United States");
      await page.fill("input[data-qa='state']", "California");
      await page.fill("input[data-qa='city']", "San Francisco");
      await page.fill("input[data-qa='zipcode']", "94105");
      await page.fill("input[data-qa='mobile_number']", "4155550188");
      await page.click("button[data-qa='create-account']");
      await page.click("a[data-qa='continue-button']");
    } else {
      await page.fill("input[data-qa='login-email']", TEST_USER.email);
      await page.fill("input[data-qa='login-password']", TEST_USER.password);
      await page.click("button[data-qa='login-button']");
    }

    await page.goto("https://automationexercise.com/products", { waitUntil: "domcontentloaded" });
    await page.click("a[href='/product_details/1']");
    await page.waitForURL("**/product_details/**");

    await page.click("button.btn.btn-default.cart");
    await page.click("a[href='/view_cart']");
    await page.waitForURL("**/view_cart");

    const cartUrl = page.url();
    openCartInBrowser(cartUrl);

    const productName = (await page.locator(".cart_description h4 a").first().textContent())?.trim() || "Blue Top";
    const totalText = (await page.locator(".cart_total_price").first().textContent())?.trim() || "$500";
    const totalCents = parsePriceToCents(totalText);
    const totalDollars = `$${(totalCents / 100).toFixed(0)}`;

    const summary = `Ready to purchase:\n  Product: ${productName}\n  Total: ${totalDollars}\n  Store: ${cartUrl}\n\nConfirm purchase? (yes/no)`;
    if (opts.onConfirmation) {
      const confirmed = await opts.onConfirmation(summary);
      if (!confirmed) {
        auditShopping({
          amount: totalCents,
          currency: "usd",
          storeUrl: opts.storeUrl,
          status: "cancelled",
          reason: "Purchase cancelled by user.",
        });
        const cancelled = {
          success: false,
          cancelled: true,
          message: "Purchase cancelled by user.",
        };
        return cancelled;
      }
    }

    const guardrail = checkGuardrails(totalCents, "usd");
    if (!guardrail.allowed) {
      auditShopping({
        amount: totalCents,
        currency: "usd",
        storeUrl: opts.storeUrl,
        status: "blocked",
        reason: guardrail.reason,
      });
      const blocked = {
        success: false,
        message: guardrail.reason ?? "Shopping blocked by guardrails.",
      };
      return blocked;
    }

    await page.click("a.btn.btn-default.check_out");
    await page.goto("https://automationexercise.com/payment", { waitUntil: "domcontentloaded" });

    await page.fill("input[data-qa='name-on-card']", "ClawPay User");
    await page.fill("input[data-qa='card-number']", opts.cardDetails.pan);
    await page.fill("input[data-qa='cvc']", opts.cardDetails.cvv);
    await page.fill("input[data-qa='expiry-month']", opts.cardDetails.expMonth);
    await page.fill("input[data-qa='expiry-year']", opts.cardDetails.expYear);
    await page.click("button[data-qa='pay-button']");

    await page.waitForURL("**/payment_done/**");
    const orderId = extractOrderId(page.url());

    recordSpend(totalCents);
    auditShopping({
      amount: totalCents,
      currency: "usd",
      storeUrl: opts.storeUrl,
      orderId,
      status: "success",
    });

    const result = {
      success: true,
      orderId,
      totalCents,
      productName,
      message: `Order placed! Order ID: ${orderId}`,
    };
    return result;
  } catch (error) {
    /* c8 ignore next */
    const message =
      timedOut
        ? "Shopping session timed out after 5 minutes."
        : error instanceof Error
          ? error.message
          : "Shopping flow failed.";
    auditShopping({
      currency: "usd",
      storeUrl: opts.storeUrl,
      status: "failed",
      reason: message,
    });
    const failed = {
      success: false,
      message,
      error: message,
    };
    return failed;
  } finally {
    _shoppingState.inProgress = false;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    await browser?.close().catch(() => {});
  }
}
