import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const EVIDENCE_DIR = ".sisyphus/evidence";

const SCREENSHOTS = {
  homepage: `${EVIDENCE_DIR}/probe-a-01-homepage.png`,
  product: `${EVIDENCE_DIR}/probe-a-02-product.png`,
  cart: `${EVIDENCE_DIR}/probe-a-03-cart.png`,
  checkout: `${EVIDENCE_DIR}/probe-a-04-checkout.png`,
  paymentFilled: `${EVIDENCE_DIR}/probe-a-05-payment-filled.png`,
  confirmation: `${EVIDENCE_DIR}/probe-a-06-confirmation.png`,
};

const USER = {
  name: "ClawPay Test",
  email: "clawpay_test@test.com",
  password: "Test1234!",
  firstName: "ClawPay",
  lastName: "Tester",
  company: "ClawPay",
  address1: "123 Test Street",
  address2: "Suite 10",
  country: "United States",
  state: "California",
  city: "San Francisco",
  zipCode: "94105",
  mobile: "4155550188",
};

const CARD = {
  name: "ClawPay Test",
  number: "4242424242424242",
  cvc: "123",
  month: "12",
  year: "2030",
};

async function loginOrRegister(page: import("playwright").Page) {
  await page.goto("https://automationexercise.com/login", { waitUntil: "domcontentloaded" });
  await page.fill("input[data-qa='login-email']", USER.email);
  await page.fill("input[data-qa='login-password']", USER.password);
  await page.click("button[data-qa='login-button']");

  if (await page.locator("p", { hasText: "Your email or password is incorrect!" }).isVisible()) {
    await page.fill("input[data-qa='signup-name']", USER.name);
    await page.fill("input[data-qa='signup-email']", USER.email);
    await page.click("button[data-qa='signup-button']");

    await page.check("#id_gender1");
    await page.fill("input[data-qa='password']", USER.password);
    await page.selectOption("select[data-qa='days']", "10");
    await page.selectOption("select[data-qa='months']", "10");
    await page.selectOption("select[data-qa='years']", "1998");
    await page.fill("input[data-qa='first_name']", USER.firstName);
    await page.fill("input[data-qa='last_name']", USER.lastName);
    await page.fill("input[data-qa='company']", USER.company);
    await page.fill("input[data-qa='address']", USER.address1);
    await page.fill("input[data-qa='address2']", USER.address2);
    await page.selectOption("select[data-qa='country']", USER.country);
    await page.fill("input[data-qa='state']", USER.state);
    await page.fill("input[data-qa='city']", USER.city);
    await page.fill("input[data-qa='zipcode']", USER.zipCode);
    await page.fill("input[data-qa='mobile_number']", USER.mobile);
    await page.click("button[data-qa='create-account']");
    await page.click("a[data-qa='continue-button']");
  }
}

async function runProbe() {
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("https://automationexercise.com", { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: SCREENSHOTS.homepage, fullPage: true });

  await page.click("a[href='/products']");
  await page.waitForURL("**/products");
  await page.click("a[href='/product_details/1']");
  if (page.url().includes("google_vignette")) {
    await page.goto("https://automationexercise.com/product_details/1", { waitUntil: "domcontentloaded" });
  }
  await page.waitForURL("**/product_details/**", { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: SCREENSHOTS.product, fullPage: true });

  await page.goto("https://automationexercise.com/add_to_cart/1", { waitUntil: "domcontentloaded" });
  await page.goto("https://automationexercise.com/view_cart", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/view_cart");
  await page.screenshot({ path: SCREENSHOTS.cart, fullPage: true });

  await page.click("a:has-text('Proceed To Checkout')");
  if (await page.locator("#checkoutModal a[href='/login']").isVisible()) {
    await page.click("#checkoutModal a[href='/login']");
    await loginOrRegister(page);
    await page.goto("https://automationexercise.com/view_cart", { waitUntil: "domcontentloaded" });
    await page.click("a:has-text('Proceed To Checkout')");
  }

  await page.waitForURL("**/checkout");
  await page.screenshot({ path: SCREENSHOTS.checkout, fullPage: true });

  await page.fill("textarea[name='message']", "Probe A checkout automation.");
  await page.click("a.check_out");
  await page.waitForURL("**/payment");

  await page.fill("input[data-qa='name-on-card']", CARD.name);
  await page.fill("input[data-qa='card-number']", CARD.number);
  await page.fill("input[data-qa='cvc']", CARD.cvc);
  await page.fill("input[data-qa='expiry-month']", CARD.month);
  await page.fill("input[data-qa='expiry-year']", CARD.year);
  await page.screenshot({ path: SCREENSHOTS.paymentFilled, fullPage: true });

  await page.click("button[data-qa='pay-button']");
  await page.locator("p", { hasText: "Congratulations! Your order has been confirmed!" }).waitFor();
  await page.screenshot({ path: SCREENSHOTS.confirmation, fullPage: true });

  console.log("PROBE A PASS: Order confirmation displayed.");

  await browser.close();
}

void runProbe();
