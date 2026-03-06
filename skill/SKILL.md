---
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
- **Audit trail:** Every action logged to `~/.clawpay/audit.log`.

## Setup (once)

```bash
mcporter call --stdio "clawpay" setup_payment
mcporter call --stdio "clawpay" setup_paypal
```

## Stripe Payments

**Create payment:**
```bash
mcporter call --stdio "clawpay" pay amount=1000 currency=usd description="Coffee"
```

**Check balance:**
```bash
mcporter call --stdio "clawpay" get_balance
```

**List transactions:**
```bash
mcporter call --stdio "clawpay" list_transactions limit=5
```

**Refund payment:**
```bash
mcporter call --stdio "clawpay" refund payment_intent_id=pi_xxx
```

## PayPal Payouts

**Send money via PayPal:**
```bash
mcporter call --stdio "clawpay" send_paypal recipientEmail=friend@example.com amount=2000 note="Lunch"
```

Or by phone:
```bash
mcporter call --stdio "clawpay" send_paypal recipientPhone=+12025551234 amount=2000
```

## Notes

- Amounts in cents: `1000` = $10.00
- Currency default: `usd`
- PayPal requires either `recipientEmail` or `recipientPhone`
- All transactions logged with timestamps and status
