import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { chromium } from "playwright";
import Stripe from "stripe";

const execFileAsync = promisify(execFile);
const EVIDENCE_DIR = ".sisyphus/evidence";
const SCREENSHOT_PAYMENT_LINK = `${EVIDENCE_DIR}/probe-b-01-payment-link.png`;
const SCREENSHOT_CHECKOUT_LOADED = `${EVIDENCE_DIR}/probe-b-02-checkout-loaded.png`;
const SCREENSHOT_FORM_FILLED = `${EVIDENCE_DIR}/probe-b-03-form-filled.png`;
const SCREENSHOT_RESULT = `${EVIDENCE_DIR}/probe-b-04-result.png`;
const API_VERIFICATION_FILE = `${EVIDENCE_DIR}/probe-b-05-api-verification.txt`;

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY environment variable is not set. " +
        "Run with STRIPE_SECRET_KEY=sk_test_... npx tsx poc/probe-b.ts",
    );
  }
  return new Stripe(key);
}

async function hasCaptcha(page: import("playwright").Page): Promise<boolean> {
  const signals = [
    "iframe[src*='captcha']",
    "iframe[src*='recaptcha']",
    "text=/verify you are human/i",
    "text=/security check/i",
    "text=/i am not a robot/i",
  ];
  for (const signal of signals) {
    if ((await page.locator(signal).count()) > 0) return true;
  }
  return false;
}

async function run(): Promise<void> {
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const stripe = getStripe();
  const key = process.env["STRIPE_SECRET_KEY"] as string;

  const price = await stripe.prices.create({
    unit_amount: 100,
    currency: "usd",
    product_data: { name: "PoC Test Product" },
  });
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
  });

  console.log(`Payment Link: ${link.url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(link.url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.screenshot({ path: SCREENSHOT_PAYMENT_LINK, fullPage: true });

  await page.waitForTimeout(1500);
  await page.screenshot({ path: SCREENSHOT_CHECKOUT_LOADED, fullPage: true });

  if (await hasCaptcha(page)) {
    await page.screenshot({ path: SCREENSHOT_FORM_FILLED, fullPage: true });
    await page.screenshot({ path: SCREENSHOT_RESULT, fullPage: true });
    console.log("CAPTCHA blocked automation");
    await browser.close();
    return;
  }

  await page.locator("input[type='email'], input[name='email']").first().fill("clawpay-test@test.com");

  const cardFrame = page.frameLocator("iframe[src*='js.stripe.com']");
  await cardFrame
    .locator("[placeholder='Card number'], input[name='cardnumber']")
    .first()
    .fill("4242424242424242");
  await cardFrame
    .locator("[placeholder='MM / YY'], input[name='exp-date']")
    .first()
    .fill("12/30");
  await cardFrame
    .locator("[placeholder='CVC'], input[name='cvc']")
    .first()
    .fill("123");

  await page.screenshot({ path: SCREENSHOT_FORM_FILLED, fullPage: true });

  await page.getByRole("button", { name: /pay/i }).first().click();
  await page.waitForTimeout(7000);
  await page.screenshot({ path: SCREENSHOT_RESULT, fullPage: true });

  if (await hasCaptcha(page)) {
    console.log("CAPTCHA blocked automation");
    await browser.close();
    return;
  }

  const successVisible = await page
    .locator("text=/payment complete|thanks for your payment|thank you/i")
    .first()
    .isVisible();

  if (successVisible || page.url().includes("success")) {
    const { stdout } = await execFileAsync("curl", [
      "https://api.stripe.com/v1/events?type=checkout.session.completed&limit=1",
      "-u",
      `${key}:`,
    ]);
    await writeFile(API_VERIFICATION_FILE, stdout, "utf8");
    console.log(`Saved API verification: ${API_VERIFICATION_FILE}`);
    await browser.close();
    return;
  }

  console.log("Checkout attempted but no success/captcha signal detected");
  await browser.close();
}

void run();
