# ClawPay Disclaimer

⚠️ IMPORTANT: Read this disclaimer carefully before using ClawPay.

By using ClawPay, you agree to the terms of the Apache License 2.0 and acknowledge this disclaimer.

---

## 1. Financial Disclaimer

This software is not financial advice. Use of ClawPay may result in real monetary transactions. You assume full responsibility for all payments initiated through this software.

ClawPay does not provide investment advice, tax guidance, or any form of financial planning. Nothing in this software or its documentation constitutes a recommendation to make any financial decision. All payment amounts, recipients, and timing are determined solely by you or by an AI agent acting under your direction.

Before deploying ClawPay in any production environment, consult qualified legal and financial professionals to understand the implications for your specific use case.

---

## 2. AI Agent Disclaimer

Actions performed by an AI agent through ClawPay are NOT acts of ClawPay's authors or contributors. The authors are not responsible for autonomous agent decisions.

When ClawPay is used as a tool by an AI agent (including but not limited to large language models, autonomous agents, or agentic frameworks), the agent acts on behalf of the user or operator who configured and deployed it, not on behalf of ClawPay's authors or contributors. The authors of ClawPay have no visibility into, control over, or responsibility for:

- Payment amounts or recipients chosen by an AI agent
- The frequency or timing of agent-initiated transactions
- Errors in agent reasoning that result in unintended payments
- Prompt injection attacks that manipulate agent behavior

You are solely responsible for implementing appropriate guardrails, spending limits, human-in-the-loop approval flows, and monitoring when deploying ClawPay in agentic contexts. The authorization ambiguity inherent in autonomous agent payments is a known risk that you must address before production use.

---

## 3. Automated Purchasing Disclaimer

The shopping feature in ClawPay automates the checkout process on merchant websites. Automated purchasing may violate the Terms of Service of some online stores. You are solely responsible for ensuring that your use of ClawPay's shopping feature complies with the Terms of Service of each merchant website where you use it.

ClawPay is a tool that executes purchasing instructions. It does not make purchasing decisions on your behalf. You must explicitly confirm every purchase before it is executed. ClawPay will not proceed with any transaction without your direct authorization.

---

## 4. Production Mode Disclaimer

**ClawPay defaults to PRODUCTION MODE for all payment services.**

- **Lithic virtual cards**: Uses production API (`https://api.lithic.com/v1`) by default. All transactions charge REAL MONEY from your Lithic account.
- **PayPal transfers**: Uses production API (`https://api-m.paypal.com`) by default. All payouts send REAL MONEY.
- **Stripe payments**: Uses live or test mode based on your API key (`sk_live_*` = production, `sk_test_*` = test).

**To use sandbox/test mode, you MUST explicitly set environment variables:**
- `LITHIC_ENVIRONMENT=sandbox` for Lithic test mode
- `PAYPAL_ENVIRONMENT=sandbox` for PayPal test mode

**Without these environment variables, all transactions are LIVE and IRREVERSIBLE.**

Before deploying ClawPay, verify:
1. Your API keys are correct (production vs sandbox)
2. Your guardrail limits are appropriate ($100/transaction, $500/day by default)
3. You understand that confirmation prompts are your ONLY protection against unintended charges
4. You have tested the automation flow in sandbox mode before using production

---

## 5. PCI DSS Statement

### Shopping Feature (Automated Checkout)

When using the shopping feature to automate checkout on merchant websites, ClawPay briefly holds the PAN (Primary Account Number) and CVV in process memory to fill merchant checkout forms. This is a temporary, in-memory operation only:

- **PAN/CVV is never written to disk** — it exists only in RAM during the checkout automation
- **PAN/CVV is never logged or included in audit entries** — the audit log records only transaction metadata, not card details
- **PAN/CVV is never sent to any ClawPay server** — ClawPay has no servers; all processing is local
- **PAN/CVV is obtained from the Lithic API** and used solely to fill merchant checkout forms via an automated browser
- **After checkout completes, the virtual card is immediately closed** — each shopping transaction uses a single-use Lithic virtual card
- **The card is a Lithic-issued virtual card**, not a real credit or debit card — it is a temporary payment instrument issued by Lithic for this specific transaction

### Stripe Payment Processing

ClawPay never processes, stores, or transmits raw cardholder data (PANs, CVVs) when using Stripe payment processing. All card input is handled exclusively by Stripe's PCI-compliant Checkout. ClawPay is not in PCI scope for Stripe transactions.

ClawPay integrates with Stripe's hosted payment pages and tokenization infrastructure. Raw card numbers, CVV codes, expiration dates, and other sensitive authentication data never pass through ClawPay's codebase, servers, or logs. Stripe holds PCI DSS Level 1 certification, the highest level of compliance available.

### Compliance Summary

For Stripe payment processing, ClawPay does not fall within the scope of PCI DSS requirements. For shopping feature usage, the brief in-memory handling of PAN/CVV is a necessary part of automated checkout automation and does not involve storage, transmission to external servers, or logging. However, your overall payment system may still have PCI obligations depending on how you deploy and integrate ClawPay. Consult a Qualified Security Assessor (QSA) if you have questions about your specific compliance posture.

---

## 6. Not a Money Transmitter

ClawPay is a software tool that interfaces with the Lithic API, PayPal API, and Stripe API. It is not a payment processor, money transmitter, or financial institution.

ClawPay does not hold, move, or settle funds. All payment processing, fund movement, and settlement is performed by Lithic, Inc., PayPal Holdings, Inc., and Stripe, Inc. under their own licenses and regulatory authorizations. ClawPay has no money transmission license and does not operate as a financial intermediary.

If your use of ClawPay involves activities that may require money transmission licenses, payment facilitator agreements, or other financial regulatory approvals in your jurisdiction, you are responsible for obtaining those approvals independently.

---

## 7. Credential Security

You are solely responsible for securing your API keys (Lithic, Stripe, PayPal). Never commit API keys to version control. ClawPay stores keys only in environment variables or `~/.clawpay/config.json`.

API keys grant the ability to initiate real financial transactions. Treat them with the same care as passwords or private keys. Specifically:

- Do not hardcode API keys in source code
- Do not commit `.env` files or any file containing API keys to git
- Rotate keys immediately if you suspect they have been exposed
- Use restricted key features to limit key permissions to only what ClawPay needs
- Audit your Lithic, Stripe, and PayPal Dashboards regularly for unexpected API activity
- **NEVER use production API keys in test/development environments**
- **NEVER use sandbox API keys in production environments**

ClawPay reads API keys from environment variables at runtime and does not persist them to disk, logs, or any external service. However, ClawPay cannot protect keys that are mishandled outside of its own execution context. A compromised key can result in unauthorized charges, refunds, or data access on your accounts.

**Environment Variable Security:**
- Production keys should ONLY be set in production deployment environments
- Use separate API keys for development, staging, and production
- Consider using secret management tools (AWS Secrets Manager, HashiCorp Vault, etc.) for production deployments
- Rotate all keys on a regular schedule (every 90 days recommended)

---

## 8. Limitation of Liability

As stated in Apache License 2.0, Section 8:

IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

This limitation applies to all damages arising from use of ClawPay, including but not limited to:

- Unauthorized or unintended payments initiated through the software
- Financial losses resulting from AI agent decisions
- Data breaches caused by improper credential handling
- Regulatory penalties arising from non-compliant deployments
- Charges incurred in production mode when sandbox mode was intended
- Any other direct or indirect financial harm

The full text of the Apache License 2.0 is available in the LICENSE file at the root of this repository.

---

*Last updated: 2026*
