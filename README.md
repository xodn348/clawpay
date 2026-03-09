[![Lithic](https://img.shields.io/badge/Lithic-Virtual_Cards-000.svg)](https://lithic.com)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)
[![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/xodn348/clawpay/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Stripe](https://img.shields.io/badge/Stripe-Powered-635BFF.svg)](https://stripe.com)
[![PayPal](https://img.shields.io/badge/PayPal-Powered-003087.svg)](https://paypal.com)

# ClawPay

**AI Shopping Agent** — connects your AI to Lithic virtual cards, Stripe, and PayPal.

> [!WARNING]
> **Production mode by default.** Real transactions, real money. Set `LITHIC_ENVIRONMENT=sandbox` for testing.

---

## ⚖️ Legal Notice

**ClawPay is a SOFTWARE CONNECTOR ONLY. We do NOT:**
- Handle, hold, or transmit your funds
- Act as a money transmitter or payment processor
- Have access to your money at any time

**Money flows directly:** YOU ↔ Lithic / Stripe / PayPal. ClawPay only connects APIs and automates browser forms.

You are responsible for compliance with payment provider terms and applicable laws. See [DISCLAIMER.md](DISCLAIMER.md) for full legal terms.

---

## Quick Start

```bash
npm install -g @xodn348/clawpay
npx playwright install chromium
export LITHIC_API_KEY=your_production_key
clawpay install
```

Then ask your AI: **"Buy me a blue t-shirt on automationexercise.com"**

---

## How It Works

1. Tell your AI what to buy and where
2. ClawPay navigates the store and shows you a summary
3. **You confirm** — no auto-purchase ever
4. A Lithic single-use virtual card is created and used for checkout
5. Card self-destructs. PAN/CVV never touch disk or logs.

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `setup_lithic` | Configure Lithic virtual card API |
| `browse_and_buy` | AI shopping with single-use virtual card |
| `setup_payment` | Configure Stripe payment method |
| `pay` | Charge via Stripe |
| `get_balance` | Stripe account balance |
| `list_transactions` | Recent Stripe payments |
| `refund` | Issue Stripe refund |
| `setup_paypal` | Configure PayPal |
| `send_paypal` | Send money via PayPal |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LITHIC_API_KEY` | Yes (shopping) | — | Lithic API key |
| `LITHIC_ENVIRONMENT` | No | `production` | `production` or `sandbox` |
| `STRIPE_SECRET_KEY` | Yes (Stripe) | — | Stripe secret key |
| `PAYPAL_CLIENT_ID` | Yes (PayPal) | — | PayPal client ID |
| `PAYPAL_CLIENT_SECRET` | Yes (PayPal) | — | PayPal client secret |
| `PAYPAL_ENVIRONMENT` | No | `production` | `production` or `sandbox` |

---

## Guardrails

Default limits: **$100/transaction**, **$500/day**, **USD only**.

Override in `~/.clawpay/config.json`:

```json
{
  "guardrails": {
    "maxAmountPerTransactionCents": 10000,
    "maxDailySpendCents": 50000,
    "allowedCurrencies": ["usd"]
  }
}
```

---

## Client Setup

**Claude Code:**
```bash
claude mcp add -s user clawpay -e LITHIC_API_KEY=your_key -- clawpay
```

**opencode.json / Claude Desktop / Cursor:**
```json
{
  "mcp": {
    "clawpay": {
      "type": "local",
      "command": ["clawpay"],
      "environment": { "LITHIC_API_KEY": "your_key" }
    }
  }
}
```

---

## Security

- PAN/CVV exist in memory only during checkout — never logged, never stored
- Stripe card data handled by PCI-compliant Stripe Checkout
- All actions logged to `~/.clawpay/audit.log` (no sensitive data)
- Guardrails block excessive spending before it reaches the API

For vulnerabilities: [SECURITY.md](SECURITY.md)

---

## License

Apache 2.0 — [LICENSE](LICENSE). Full legal terms: [DISCLAIMER.md](DISCLAIMER.md).
