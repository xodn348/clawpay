[![Lithic](https://img.shields.io/badge/Lithic-Virtual_Cards-000.svg)](https://lithic.com)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)
[![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/xodn348/clawpay/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Stripe](https://img.shields.io/badge/Stripe-Powered-635BFF.svg)](https://stripe.com)
[![PayPal](https://img.shields.io/badge/PayPal-Powered-003087.svg)](https://paypal.com)

# ClawPay

Open-source AI Shopping Agent. Tell your AI what to buy — ClawPay handles the rest using Lithic virtual cards.

> [!WARNING]
> ClawPay makes real purchases using Lithic virtual cards. Real money is involved.
> Every purchase requires your explicit confirmation. Review your guardrail limits before use.
> See [DISCLAIMER.md](DISCLAIMER.md) for full terms.

---

## Quick Start

```bash
npm install -g @xodn348/clawpay
npm install -g playwright && npx playwright install chromium
export LITHIC_API_KEY=your_lithic_api_key
clawpay install
```

Then ask your AI: **"Buy me a blue t-shirt on automationexercise.com"**

---

## How It Works

1. You tell your AI what to buy and where
2. ClawPay launches a headless browser and navigates the store
3. It finds your product, adds it to cart, and shows you a summary
4. You confirm or cancel
5. ClawPay generates a Lithic single-use virtual card and completes checkout
6. The card self-destructs after the transaction

The virtual card exists only for that one purchase. PAN and CVV never touch disk or logs.

---

## AI Shopping Agent

ClawPay's AI Shopping Agent lets you buy products from online stores using plain English. The agent browses the store, fills the cart, shows you a summary, asks for your confirmation, then pays using a Lithic single-use virtual card.

**Example prompt:**
> "Buy me a blue t-shirt on automationexercise.com"

The agent will find the product, add it to the cart, show you the total, and wait for your approval before charging anything.

### How it works

1. You describe what you want to buy and where.
2. ClawPay launches a Playwright browser and navigates to the store.
3. It searches for your product, selects it, and proceeds to checkout.
4. You see a summary: product name, price, and store.
5. You confirm or cancel.
6. On confirmation, ClawPay generates a Lithic single-use virtual card and completes the purchase.

### Supported stores

| Store | Status |
|-------|--------|
| automationexercise.com | Supported |

### Requirements

- [Playwright](https://playwright.dev) with Chromium

Install Playwright and its browser:

```bash
npm install -g playwright
npx playwright install chromium
```

---

## Guardrails Configuration

Default limits are conservative. To change them, edit `~/.clawpay/config.json`:

```json
{
  "guardrails": {
    "maxAmountPerTransactionCents": 10000,
    "maxDailySpendCents": 50000,
    "allowedCurrencies": ["usd"]
  }
}
```

The defaults are:

- `maxAmountPerTransactionCents`: `10000` ($100.00)
- `maxDailySpendCents`: `50000` ($500.00)
- `allowedCurrencies`: `["usd"]`

Any transaction that exceeds these limits is rejected before it reaches the payment provider.

---

## Additional Features

ClawPay also includes tools for Stripe merchant management and PayPal transfers.

### Stripe Merchant Tools

If you run a Stripe-powered business, ClawPay lets your AI manage it:

- **Check balance**: "What's my Stripe balance?"
- **View transactions**: "Show my last 10 transactions"
- **Issue refunds**: "Refund the last payment"
- **Accept payments**: "Set up payment method" / "Charge $25"

Set `STRIPE_SECRET_KEY` to enable. SSN is enough to sign up — no business entity required.

### PayPal Transfers

Send money to anyone with a PayPal account:

- **Send money**: "Send $30 to friend@email.com"

Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` to enable.

---

## MCP Tools Reference

ClawPay exposes nine tools over the MCP stdio protocol.

### `setup_lithic`

Set up Lithic virtual card API for AI shopping. Reads `LITHIC_API_KEY` from the environment and saves the configuration to `~/.clawpay/config.json`. No parameters.

### `browse_and_buy`

Launches a Playwright browser, navigates to the specified store, finds the product, and completes checkout using a Lithic single-use virtual card. Asks for confirmation before charging.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `store_url` | string | yes | URL of the online store |
| `product_query` | string | yes | Product to search for and buy |

Returns a `ShoppingResult` with fields: `success`, `orderId`, `totalCents`, `productName`, `message`, `cancelled`.

> [!WARNING]
> `browse_and_buy` makes real purchases using Lithic virtual cards. Review your guardrail limits before use.

### `setup_payment`

Opens Stripe Checkout in your browser to register a card. Saves the resulting Stripe customer ID and payment method ID to `~/.clawpay/config.json`. No parameters.

### `pay`

Charges the registered payment method.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `amount` | integer | yes | | Amount in cents (e.g., `1000` for $10.00) |
| `currency` | string | no | `"usd"` | ISO 4217 currency code |
| `description` | string | yes | | Human-readable description of the charge |

Returns a `PaymentResult` with fields: `success`, `paymentIntentId`, `amount`, `currency`, `status`, `error`.

### `get_balance`

Returns the current Stripe account balance. No parameters.

Returns a `BalanceInfo` with `available` and `pending` arrays, each containing `amount` (cents) and `currency`.

### `list_transactions`

Lists recent payment intents from your Stripe account.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | no | `10` | Number of transactions to return (max 100) |

Returns an array of `Transaction` objects with fields: `id`, `amount`, `currency`, `description`, `status`, `created`.

### `refund`

Issues a full refund for a previous payment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `payment_intent_id` | string | yes | The `paymentIntentId` from a previous `pay` call |

Returns a `RefundResult` with fields: `success`, `refundId`, `amount`, `status`, `error`. Partial refunds are not supported.

### `setup_paypal`

Links your PayPal account by saving Client ID and Client Secret to `~/.clawpay/config.json`. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` environment variables, or ClawPay will read them from the config file. No parameters.

### `send_paypal`

Sends money via PayPal Payouts to an email address or phone number.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `recipientEmail` | string | no* | | PayPal email address of recipient |
| `recipientPhone` | string | no* | | Phone number of recipient (E.164 format) |
| `amount` | integer | yes | | Amount in cents (e.g., `2000` for $20.00) |
| `currency` | string | no | `"usd"` | ISO 4217 currency code |
| `note` | string | no | | Optional note to recipient |

*One of `recipientEmail` or `recipientPhone` is required.

Returns a `SendMoneyResult` with fields: `success`, `payoutBatchId`, `amount`, `currency`, `status`, `error`.

---

## Manual Configuration

If auto-detection doesn't find your client, add ClawPay manually.

### OpenCode (`opencode.json`)

```json
{
  "mcp": {
    "clawpay": {
      "type": "local",
      "command": ["clawpay"],
      "environment": {
        "LITHIC_API_KEY": "your_lithic_api_key",
        "STRIPE_SECRET_KEY": "sk_test_...",
        "PAYPAL_CLIENT_ID": "your-paypal-client-id",
        "PAYPAL_CLIENT_SECRET": "your-paypal-client-secret"
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "clawpay": {
      "command": "clawpay",
      "args": [],
      "env": {
        "LITHIC_API_KEY": "your_lithic_api_key",
        "STRIPE_SECRET_KEY": "sk_test_...",
        "PAYPAL_CLIENT_ID": "your-paypal-client-id",
        "PAYPAL_CLIENT_SECRET": "your-paypal-client-secret"
      }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

Same format as Claude Desktop above.

### Claude Code

Run in your terminal:

```bash
claude mcp add -s user clawpay \
  -e LITHIC_API_KEY=your_lithic_api_key \
  -e STRIPE_SECRET_KEY=sk_test_... \
  -e PAYPAL_CLIENT_ID=your-paypal-client-id \
  -e PAYPAL_CLIENT_SECRET=your-paypal-client-secret \
  -- clawpay
```

This registers ClawPay globally across all Claude Code projects. Stripe and PayPal credentials are optional.

### OpenClaw

Install ClawPay and mcporter (the MCP bridge):

```bash
npm install -g @xodn348/clawpay mcporter
```

Or install the skill via ClawdHub:

```bash
clawdhub install clawpay
```

OpenClaw uses ClawPay through the mcporter bridge. Set your credentials as environment variables:

```bash
export LITHIC_API_KEY=your_lithic_api_key
export STRIPE_SECRET_KEY=sk_test_...              # optional
export PAYPAL_CLIENT_ID=your-paypal-client-id      # optional
export PAYPAL_CLIENT_SECRET=your-paypal-client-secret  # optional
```

Then ask OpenClaw: **"Buy me a blue t-shirt on automationexercise.com"** to get started.

Replace `your_lithic_api_key` with your actual Lithic API key. Stripe and PayPal credentials are optional — only needed for merchant tools and PayPal transfers.

---

## Audit Log

Every action ClawPay takes is recorded to `~/.clawpay/audit.log` as JSON Lines (one JSON object per line).

**Location:** `~/.clawpay/audit.log`

**View live:**
```bash
tail -f ~/.clawpay/audit.log | jq .
```

Each entry contains: `timestamp` (ISO 8601), `action`, `amount`, `currency`, `status`, and optionally `paymentIntentId`, `refundId`, or `reason`. API keys, card numbers, and other sensitive data are never written to this file.

---

## Security & Safety

**AI Shopping Agent card data.** When `browse_and_buy` runs, Lithic generates a single-use virtual card (PAN and CVV) that exists briefly in memory to complete the checkout form. This data is never logged, never written to disk, and discarded immediately after the transaction completes.

**Stripe card data.** All card entry happens inside Stripe Checkout, which is PCI DSS compliant. ClawPay only ever stores and uses Stripe customer IDs and payment method IDs.

**Built-in Guardrails.** Out of the box, ClawPay enforces a $100 per-transaction maximum, a $500 daily spend cap, and USD-only payments. All limits are configurable in `~/.clawpay/config.json`.

**Full Audit Trail.** Every payment, refund, and setup event is written to `~/.clawpay/audit.log` as JSON lines. No API keys or card data are ever logged.

**Automated Security.** The CI pipeline runs a hardcoded-key scan on every push. Dependabot sends weekly dependency update PRs. GitHub secret scanning is enabled on the repository.

For vulnerability reports, see [SECURITY.md](SECURITY.md). For full legal terms, see [DISCLAIMER.md](DISCLAIMER.md).

---

## Contributing

Pull requests are welcome. Please open an issue first for significant changes.

To report a security vulnerability, follow the process in [SECURITY.md](SECURITY.md). Do not open a public issue for security bugs.

---

## License

Apache 2.0. See [LICENSE](LICENSE) for details.
