[![CI](https://github.com/xodn348/clawpay/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/xodn348/clawpay/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/xodn348/clawpay/graph/badge.svg)](https://codecov.io/gh/xodn348/clawpay)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Stripe](https://img.shields.io/badge/Stripe-Powered-635BFF.svg)](https://stripe.com)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)

# ClawPay

Open-source Stripe MCP Server for AI Agents. Let Claude, OpenCode, and any MCP client make payments.

> [!WARNING]
> ClawPay enables AI agents to make real financial transactions. Real money is involved.
> AI agent payments may be irreversible. You are responsible for all charges made through your Stripe account.
> Review your guardrail limits before use. See [DISCLAIMER.md](DISCLAIMER.md) for full terms.

---

## Quick Start

```bash
npm install -g clawpay
clawpay install
```

`clawpay install` handles the full setup automatically:

1. Prompts for your Stripe secret key
2. Detects OpenCode, Claude Desktop, and Cursor on your machine
3. Patches their MCP config files to register ClawPay
4. Confirms the connection

Once installed, open your AI assistant and say: **"set up payment method"** to register a card through Stripe Checkout.

---

## Installation

```bash
# npm
npm install -g clawpay

# bun
bun add -g clawpay

# brew (coming soon)
brew tap xodn348/clawpay
brew install clawpay
```

Node.js 18 or higher is required.

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
        "STRIPE_SECRET_KEY": "sk_test_..."
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
        "STRIPE_SECRET_KEY": "sk_test_..."
      }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

Same format as Claude Desktop above.

Replace `sk_test_...` with your actual Stripe secret key. Use a test key (`sk_test_`) during development and a live key (`sk_live_`) only in production.

---

## MCP Tools Reference

ClawPay exposes five tools over the MCP stdio protocol.

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

Any `pay` call that exceeds these limits is rejected before it reaches Stripe.

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

## Contributing

Pull requests are welcome. Please open an issue first for significant changes.

To report a security vulnerability, follow the process in [SECURITY.md](SECURITY.md). Do not open a public issue for security bugs.

---

## Security & Safety

**ClawPay never sees your card data.** All card entry happens inside Stripe Checkout, which is PCI DSS compliant. ClawPay only ever stores and uses Stripe customer IDs and payment method IDs.

**Built-in Guardrails.** Out of the box, ClawPay enforces a $100 per-transaction maximum, a $500 daily spend cap, and USD-only payments. All limits are configurable in `~/.clawpay/config.json`.

**Full Audit Trail.** Every payment, refund, and setup event is written to `~/.clawpay/audit.log` as JSON lines. No API keys or card data are ever logged.

**Automated Security.** The CI pipeline runs a hardcoded-key scan on every push. Dependabot sends weekly dependency update PRs. GitHub secret scanning is enabled on the repository.

For vulnerability reports, see [SECURITY.md](SECURITY.md). For full legal terms, see [DISCLAIMER.md](DISCLAIMER.md).

---

## License

Apache 2.0. See [LICENSE](LICENSE) for details.
