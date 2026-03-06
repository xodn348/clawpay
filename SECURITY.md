# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue to report security vulnerabilities.**

Report security issues through [GitHub Security Advisories](https://github.com/clawpay/clawpay/security/advisories/new). This keeps the disclosure private until a fix is available.

When submitting a report, include:

- A clear description of the vulnerability
- Steps to reproduce the issue
- The potential impact (what an attacker could do)
- Any proof-of-concept code or screenshots, if applicable

We will acknowledge your report within **48 hours** and aim to resolve confirmed vulnerabilities within **7 days**. We'll keep you updated on progress throughout the process.

---

## Scope

### In Scope

The following vulnerability types are relevant to ClawPay and should be reported:

- **Unauthorized payment initiation** -- flaws that allow an attacker to trigger Stripe charges without proper authorization
- **API key exposure** -- code paths, logs, or error messages that leak Stripe secret keys or restricted keys
- **Prompt injection** -- inputs that manipulate AI agent behavior to initiate unintended payments or bypass spending controls
- **Guardrail bypass** -- techniques that circumvent spending limits, approval flows, or other safety controls built into ClawPay
- **Dependency vulnerabilities** -- critical CVEs in ClawPay's direct dependencies that affect payment security

### Out of Scope

The following are outside ClawPay's control and should be reported to the relevant party instead:

- **Stripe platform bugs** -- vulnerabilities in Stripe's API, dashboard, or infrastructure. Report these to [Stripe's security team](https://stripe.com/docs/security).
- **User misconfiguration** -- issues that arise from deploying ClawPay with insecure settings (e.g., exposing API keys in environment variables that are publicly accessible). These are operator responsibilities.
- **Test mode issues** -- behavior in Stripe test mode that does not affect real funds or production credentials.
- **Social engineering** -- attacks that require tricking a user into revealing their own credentials.
- **Theoretical vulnerabilities** -- reports without a demonstrated impact or reproducible proof of concept.

---

## Response Timeline

| Stage | Target |
|---|---|
| Acknowledgment | Within 48 hours of report |
| Triage and severity assessment | Within 3 business days |
| Fix or mitigation | Within 7 days for critical issues |
| Public disclosure | After fix is released, coordinated with reporter |

For non-critical issues, timelines may extend based on complexity. We'll communicate any delays directly.

---

## No Reward Program

ClawPay does not currently offer a bug bounty or financial reward program. We appreciate responsible disclosure and will credit researchers in release notes if they wish to be acknowledged.

---

## Supported Versions

Security fixes are applied to the latest release only. We recommend always running the most recent version of ClawPay.

---

*For general questions or non-security bugs, open a standard GitHub issue.*
