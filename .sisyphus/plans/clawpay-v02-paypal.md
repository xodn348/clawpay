# ClawPay v0.2 — Add PayPal P2P Sending

## TL;DR

> **Quick Summary**: Add PayPal P2P sending alongside existing Stripe integration. Users can send money via PayPal (email/phone) through AI agents, while Stripe continues to handle merchant payments. ClawPay remains an open-source developer tool — no money flow involvement.
> 
> **Deliverables**:
> - PayPal REST API client module (`src/paypal.ts`)
> - PayPal OAuth setup flow (`src/setup-paypal.ts`)
> - 2 new MCP tools: `setup_paypal`, `send_paypal`
> - Updated installer to optionally collect PayPal credentials
> - Updated types, config, guardrails for PayPal
> - PayPal badge in README, dual-payment documentation
> - Tests maintaining 100% coverage
> - npm publish @xodn348/clawpay@0.2.0
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Types → PayPal Client → MCP Tools → Integration Tests → Publish

---

## Context

### Original Request
User wants ClawPay to support dual payment: Stripe (for merchant payments, existing) + PayPal (for P2P sending, new). The user's ultimate vision is "register payment method once, AI handles payments." PayPal P2P fills a gap Stripe cannot: sending money to anyone via email/phone without merchant integration.

### Interview Summary
**Key Discussions**:
- User initially wanted browser automation (Playwright fills checkout forms) — research proved this technically impossible (cross-origin iframe) and ToS-violating
- Discovered current Stripe API model (`off_session: true`) is already correct — same pattern as terminal.shop, Uber, DoorDash
- PayPal Payouts API requires Business account — user willing to register via ebsilon
- ClawPay is open-source tool only — no business registration needed for ClawPay itself
- Each developer who uses ClawPay provides their own API keys

**Research Findings**:
- Stripe iframe is cross-origin → Playwright cannot access card fields (browser security fundamental)
- terminal.shop uses identical Stripe pattern: client-side tokenization → `pm_xxx` → off-session charge
- Stripe has official Agent Toolkit + MCP server (`@stripe/agent-toolkit`)
- PayPal official MCP server (`@paypal/mcp`) has NO payout/send tools
- PayPal community MCP server shows auto-refresh OAuth pattern (Client ID + Secret)
- PCI DSS 3.3.1 prohibits CVV storage even encrypted — current `pm_xxx` model is correct
- Legal basis: Merchant-Initiated Transaction (MIT) framework

### Metis Review
**Identified Gaps** (addressed):
- PayPal Payouts requires Business account → user will register via ebsilon
- Tool naming asymmetry (Stripe unnamespaced vs PayPal namespaced) → accept for v0.2, plan migration for v1.0
- PayPal OAuth token refresh → use Client ID + Secret with auto-refresh, not pre-generated tokens
- No interactive setup in MCP protocol → extend `clawpay install` CLI for PayPal credentials
- PayPal environment variable needed → `PAYPAL_ENVIRONMENT=sandbox|production`

---

## Work Objectives

### Core Objective
Add PayPal P2P sending capability to ClawPay while maintaining existing Stripe integration, 100% test coverage, and zero involvement in money flow.

### Concrete Deliverables
- `src/paypal.ts` — PayPal REST API client (sendMoney, getPaypalBalance)
- `src/setup-paypal.ts` — OAuth flow for PayPal account linking
- Updated `src/types.ts` — PayPal types (PayPalConfig, SendMoneyRequest, SendMoneyResult)
- Updated `src/config.ts` — PayPal config storage
- Updated `src/guardrails.ts` — Audit logging for PayPal operations
- Updated `src/index.ts` — 2 new MCP tools (setup_paypal, send_paypal)
- Updated `src/installer.ts` — Optional PayPal credential collection
- Updated `README.md` — PayPal badge, dual-payment docs, new tools reference
- Updated `test/integration.test.ts` — PayPal tests, maintain 100% coverage
- npm publish `@xodn348/clawpay@0.2.0`

### Definition of Done
- [ ] `bun test` → 0 failures, all tests pass
- [ ] `c8` coverage → 100% statements, branches, functions, lines
- [ ] `tsc --noEmit` → 0 errors
- [ ] MCP server lists 7 tools (5 existing + 2 new)
- [ ] PayPal send works in sandbox mode
- [ ] README has PayPal badge and documentation
- [ ] npm published as @xodn348/clawpay@0.2.0

### Must Have
- PayPal REST API integration (Payouts for P2P sending)
- OAuth token auto-refresh (Client ID + Secret, not pre-generated tokens)
- PayPal sandbox/production environment switching
- Guardrails enforced for PayPal same as Stripe (per-transaction, daily, currency limits)
- Full audit trail for PayPal operations
- 100% test coverage maintained
- All code/comments in English
- Node.js 18+ compatible

### Must NOT Have (Guardrails)
- NO browser automation / Playwright — technically impossible and ToS-violating
- NO local card/payment data storage — only API tokens
- NO renaming existing Stripe MCP tools — backward compatibility
- NO handling raw card data (PAN, CVV) — PCI non-scope
- NO Korean in code/comments/README
- NO involvement in money flow — ClawPay is a tool, not a financial service
- NO dependency on `@paypal/mcp` official package — it uses pre-generated tokens and lacks payout tools
- NO interactive credential prompts during MCP server runtime — only in `clawpay install`

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (node:test + c8)
- **Automated tests**: YES (tests-after — extend existing test suite)
- **Framework**: node:test + c8 coverage
- **Coverage target**: 100% all metrics (statements, branches, functions, lines)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **API/Backend**: Use Bash (curl/node REPL) — call functions, assert return values
- **CLI**: Use Bash — run commands, validate output
- **MCP**: Use Bash — start server, list tools, verify tool schemas

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — types + config foundation):
├── Task 1: PayPal type definitions [quick]
├── Task 2: Config module PayPal extension [quick]
├── Task 3: Guardrails/audit PayPal extension [quick]
└── Task 4: PayPal REST API research & sandbox setup [quick]

Wave 2 (After Wave 1 — core modules, PARALLEL):
├── Task 5: PayPal REST API client (depends: 1, 2, 4) [deep]
├── Task 6: PayPal setup flow (depends: 1, 2) [unspecified-high]
├── Task 7: Installer PayPal extension (depends: 1) [quick]
└── Task 8: README + badge update (depends: none) [writing]

Wave 3 (After Wave 2 — integration + publish):
├── Task 9: MCP server tool registration (depends: 5, 6) [unspecified-high]
├── Task 10: Integration tests (depends: 5, 6, 7, 9) [deep]
├── Task 11: CI pipeline update (depends: 10) [quick]
└── Task 12: npm publish v0.2.0 (depends: 10, 11) [quick]

Wave FINAL (After ALL tasks — verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real QA — MCP server test (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 5 → Task 9 → Task 10 → Task 12 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Wave 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 5, 6, 7, 9 | 1 |
| 2 | — | 5, 6 | 1 |
| 3 | — | 5, 10 | 1 |
| 4 | — | 5 | 1 |
| 5 | 1, 2, 4 | 9, 10 | 2 |
| 6 | 1, 2 | 9, 10 | 2 |
| 7 | 1 | 10 | 2 |
| 8 | — | 12 | 2 |
| 9 | 5, 6 | 10 | 3 |
| 10 | 5, 6, 7, 9 | 11, 12 | 3 |
| 11 | 10 | 12 | 3 |
| 12 | 10, 11 | F1-F4 | 3 |

### Agent Dispatch Summary

- **Wave 1**: 4 tasks — T1-T3 → `quick`, T4 → `quick`
- **Wave 2**: 4 tasks — T5 → `deep`, T6 → `unspecified-high`, T7 → `quick`, T8 → `writing`
- **Wave 3**: 4 tasks — T9 → `unspecified-high`, T10 → `deep`, T11 → `quick`, T12 → `quick`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. PayPal Type Definitions

  **What to do**:
  - Add PayPal-specific types to `src/types.ts`:
    - `PayPalConfig` — clientId, clientSecret, environment (sandbox/production), accessToken, refreshToken, tokenExpiresAt
    - `SendMoneyRequest` — recipientEmail or recipientPhone, amountCents, currency, note (optional)
    - `SendMoneyResult` — success, payoutBatchId, amount, currency, status, error
    - `PayPalBalanceInfo` — available array with amount + currency
  - Extend `ClawPayConfig` interface to include optional `paypal?: PayPalConfig`
  - Add `DEFAULT_PAYPAL_CONFIG` with sandbox defaults

  **Must NOT do**:
  - Do NOT modify any existing Stripe types
  - Do NOT add card data types (PAN, CVV) — forbidden
  - Do NOT add Korean comments

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 9
  - **Blocked By**: None

  **References**:
  - `src/types.ts` — Current type definitions, follow same patterns (line 1-70)
  - PayPal Payouts API response schema: https://developer.paypal.com/docs/api/payments.payouts-batch/v1/

  **Acceptance Criteria**:
  - [ ] `tsc --noEmit` → 0 errors
  - [ ] All new types exported from types.ts
  - [ ] `PayPalConfig` has all required fields

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: TypeScript compilation succeeds with new types
    Tool: Bash
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert: exit code 0, no errors
    Expected Result: Clean compilation
    Evidence: .sisyphus/evidence/task-1-typecheck.txt

  Scenario: Types are importable
    Tool: Bash
    Steps:
      1. Run: node --import tsx -e "import { SendMoneyRequest, SendMoneyResult, PayPalConfig } from './src/types.js'; console.log('OK')"
      2. Assert: output contains "OK"
    Expected Result: All types import successfully
    Evidence: .sisyphus/evidence/task-1-import.txt
  ```

  **Commit**: YES (groups with Tasks 2, 3)
  - Message: `feat(types): add PayPal type definitions and config support`
  - Files: `src/types.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 2. Config Module PayPal Extension

  **What to do**:
  - Update `src/config.ts` to handle PayPal configuration:
    - `loadConfig()` should merge PayPal defaults if `paypal` key is missing
    - `saveConfig()` should persist PayPal config
    - Add `isPayPalConfigured()` — checks if PayPal clientId + clientSecret are set
    - Add `getPayPalEnv()` — returns "sandbox" or "production" based on config
  - PayPal credentials stored in `~/.clawpay/config.json` alongside Stripe credentials
  - Support environment variables: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT`

  **Must NOT do**:
  - Do NOT modify existing Stripe config logic
  - Do NOT store raw card data

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: None

  **References**:
  - `src/config.ts` — Current config module (lines 1-116). Follow same patterns: `loadConfig()`, `saveConfig()`, `isConfigured()`
  - `src/types.ts` — ClawPayConfig interface that gets extended

  **Acceptance Criteria**:
  - [ ] `isPayPalConfigured()` returns false when no PayPal config exists
  - [ ] `loadConfig()` merges PayPal defaults
  - [ ] Environment variables override config file values
  - [ ] `tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: PayPal config defaults loaded when absent
    Tool: Bash
    Steps:
      1. Run: node --import tsx -e "import { loadConfig } from './src/config.js'; const c = loadConfig(); console.log(JSON.stringify(c.paypal))"
      2. Assert: output contains default PayPal config with environment: "sandbox"
    Expected Result: Default PayPal config loaded
    Evidence: .sisyphus/evidence/task-2-defaults.txt

  Scenario: isPayPalConfigured returns false without credentials
    Tool: Bash
    Steps:
      1. Run: node --import tsx -e "import { isPayPalConfigured } from './src/config.js'; console.log(isPayPalConfigured())"
      2. Assert: output is "false"
    Expected Result: false when no credentials
    Evidence: .sisyphus/evidence/task-2-not-configured.txt
  ```

  **Commit**: YES (groups with Tasks 1, 3)
  - Message: `feat(types): add PayPal type definitions and config support`
  - Files: `src/config.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 3. Guardrails/Audit PayPal Extension

  **What to do**:
  - Add `auditPayPalSend(opts)` to `src/guardrails.ts` — logs PayPal send attempts
  - Add `auditPayPalSetup(status, reason)` — logs PayPal account linking
  - Ensure `checkGuardrails()` in `src/config.ts` applies to PayPal sends too (same limits)
  - PayPal audit entries should include: timestamp, action ("paypal_send"), amount, currency, recipientEmail/Phone (masked), status, payoutBatchId

  **Must NOT do**:
  - Do NOT log full email/phone — mask as `j***@example.com`, `***-***-1234`
  - Do NOT modify existing Stripe audit functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 5, 10
  - **Blocked By**: None

  **References**:
  - `src/guardrails.ts` — Current audit functions (lines 1-70). Follow same pattern as `auditPayment()`, `auditRefund()`
  - `src/config.ts:checkGuardrails()` — Lines 81-116. Same guardrail checks apply to PayPal

  **Acceptance Criteria**:
  - [ ] `auditPayPalSend()` writes JSON line to audit.log
  - [ ] Recipient info is masked in logs
  - [ ] `tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: PayPal send audit entry written correctly
    Tool: Bash
    Steps:
      1. Run: node --import tsx -e "import { auditPayPalSend } from './src/guardrails.js'; auditPayPalSend({ amount: 2000, currency: 'usd', recipientEmail: 'test@example.com', status: 'success', payoutBatchId: 'batch_123' })"
      2. Read last line of ~/.clawpay/audit.log
      3. Assert: contains action "paypal_send", masked email "t***@example.com"
    Expected Result: Masked audit entry written
    Evidence: .sisyphus/evidence/task-3-audit.txt

  Scenario: Email masking works correctly
    Tool: Bash
    Steps:
      1. Test with "john.doe@gmail.com" → expect "j***@gmail.com"
      2. Test with "a@b.com" → expect "a***@b.com"
    Expected Result: Consistent masking
    Evidence: .sisyphus/evidence/task-3-masking.txt
  ```

  **Commit**: YES (groups with Tasks 1, 2)
  - Message: `feat(types): add PayPal type definitions and config support`
  - Files: `src/guardrails.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 4. PayPal REST API Research & Sandbox Setup Documentation

  **What to do**:
  - Research PayPal Payouts API v1 for P2P sending:
    - Endpoint: `POST /v1/payments/payouts`
    - Auth: OAuth2 Client Credentials (Client ID + Secret → access_token)
    - Required scopes for Payouts
    - Sandbox vs Production base URLs
  - Create a brief internal doc (as comments in paypal.ts) noting:
    - API base URL: `https://api-m.sandbox.paypal.com` vs `https://api-m.paypal.com`
    - Token endpoint: `POST /v1/oauth2/token` with Basic auth (clientId:clientSecret)
    - Payouts endpoint: `POST /v1/payments/payouts`
    - Get payout status: `GET /v1/payments/payouts/{payout_batch_id}`
  - Verify sandbox access works with test credentials

  **Must NOT do**:
  - Do NOT write implementation code yet (just research + document)
  - Do NOT use pre-generated access tokens — document Client ID + Secret flow

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - PayPal Payouts API: https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
  - PayPal OAuth: https://developer.paypal.com/api/rest/authentication/
  - PayPal Sandbox: https://developer.paypal.com/tools/sandbox/

  **Acceptance Criteria**:
  - [ ] API endpoints documented
  - [ ] Auth flow documented
  - [ ] Sandbox URLs confirmed

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: PayPal sandbox OAuth token retrieval
    Tool: Bash
    Steps:
      1. Run: curl -s -X POST https://api-m.sandbox.paypal.com/v1/oauth2/token -H "Accept: application/json" -u "$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET" -d "grant_type=client_credentials"
      2. Assert: response contains "access_token" field
    Expected Result: Valid access token returned
    Failure Indicators: 401 Unauthorized, missing credentials
    Evidence: .sisyphus/evidence/task-4-oauth.txt
  ```

  **Commit**: NO (research task, no code changes)

- [ ] 5. PayPal REST API Client

  **What to do**:
  - Create `src/paypal.ts` with:
    - `getAccessToken()` — OAuth2 client credentials flow (Client ID + Secret → access_token). Auto-refresh when expired (cache token with expiry timestamp, refresh 1 minute before expiry)
    - `sendMoney(request: SendMoneyRequest)` — Calls PayPal Payouts API to send money via email or phone
      - Calls `checkGuardrails()` before sending
      - Calls `auditPayPalSend()` after
      - Calls `recordSpend()` on success
      - Returns `SendMoneyResult`
    - `getPayPalBalance()` — Returns PayPal account balance (if available via API)
    - `verifyPayPalConnection()` — Tests API credentials validity
  - OAuth token caching: store access_token + expires_at in memory (not on disk)
  - Use native `fetch()` (Node 18+) — no additional HTTP library needed
  - API base URL from config: sandbox or production

  **Must NOT do**:
  - Do NOT use pre-generated access tokens
  - Do NOT store access_token on disk (only in memory)
  - Do NOT take dependency on any PayPal npm package
  - Do NOT handle raw card data
  - Do NOT use `axios` or other HTTP libraries — use native `fetch()`

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
    - This is the core PayPal module. Needs careful OAuth implementation and error handling.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Tasks 1, 2, 4

  **References**:
  - `src/stripe.ts` — Follow same pattern: lazy client init, guardrail check before action, audit after action (lines 57-133)
  - `src/types.ts` — `SendMoneyRequest`, `SendMoneyResult` types (added in Task 1)
  - `src/config.ts` — `checkGuardrails()`, `recordSpend()` (lines 81-116)
  - `src/guardrails.ts` — `auditPayPalSend()` (added in Task 3)
  - PayPal Payouts API: https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
  - PayPal OAuth: https://developer.paypal.com/api/rest/authentication/
  - Community MCP server auto-refresh pattern: Client ID + Secret, refresh 1 min before expiry

  **Acceptance Criteria**:
  - [ ] `getAccessToken()` returns valid token from sandbox
  - [ ] Token auto-refreshes when expired
  - [ ] `sendMoney()` calls guardrails before sending
  - [ ] `sendMoney()` writes audit log after sending
  - [ ] `sendMoney()` records spend on success
  - [ ] `verifyPayPalConnection()` returns true with valid credentials
  - [ ] `tsc --noEmit` → 0 errors
  - [ ] Uses native `fetch()` only, no HTTP library

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: OAuth token retrieval and caching
    Tool: Bash
    Steps:
      1. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET env vars (sandbox)
      2. Run: node --import tsx -e "import { getAccessToken } from './src/paypal.js'; const t = await getAccessToken(); console.log(typeof t, t.length > 10)"
      3. Assert: output shows "string true"
    Expected Result: Valid access token cached
    Evidence: .sisyphus/evidence/task-5-oauth.txt

  Scenario: Guardrails block oversized PayPal send
    Tool: Bash
    Steps:
      1. Run: node --import tsx -e "import { sendMoney } from './src/paypal.js'; const r = await sendMoney({ recipientEmail: 'test@test.com', amountCents: 999999, currency: 'usd' }); console.log(r.success, r.error)"
      2. Assert: success is false, error contains "exceeds" or "limit"
    Expected Result: Blocked by guardrails
    Evidence: .sisyphus/evidence/task-5-guardrail-block.txt

  Scenario: Send money with invalid credentials fails gracefully
    Tool: Bash
    Steps:
      1. Set PAYPAL_CLIENT_ID=invalid, PAYPAL_CLIENT_SECRET=invalid
      2. Run: node --import tsx -e "import { verifyPayPalConnection } from './src/paypal.js'; console.log(await verifyPayPalConnection())"
      3. Assert: returns false, no uncaught exception
    Expected Result: Graceful failure, returns false
    Evidence: .sisyphus/evidence/task-5-invalid-creds.txt
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `feat(paypal): add PayPal REST API client and setup flow`
  - Files: `src/paypal.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 6. PayPal Setup Flow

  **What to do**:
  - Create `src/setup-paypal.ts` with `runPayPalSetup()`:
    - If PayPal credentials not in env vars, prompt user for Client ID + Secret (stdin)
    - Test credentials by calling `verifyPayPalConnection()`
    - If valid: save to `~/.clawpay/config.json`
    - Print success message with masked credentials
    - Print instructions: "You can now use the send_paypal tool"
  - Flow similar to existing `src/setup.ts` but simpler (no browser needed — just credentials)

  **Must NOT do**:
  - Do NOT open browser for PayPal OAuth (that's for future version)
  - Do NOT store credentials in plain text in logs
  - Do NOT add interactive prompts during MCP server runtime

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/setup.ts` — Current Stripe setup flow pattern (lines 1-179). Follow same structure but simpler
  - `src/config.ts` — `saveConfig()` for persisting credentials
  - `src/paypal.ts` — `verifyPayPalConnection()` (added in Task 5)

  **Acceptance Criteria**:
  - [ ] Credentials saved to ~/.clawpay/config.json
  - [ ] Invalid credentials detected and reported
  - [ ] Success message printed with masked credentials
  - [ ] `tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Valid credentials saved successfully
    Tool: Bash
    Steps:
      1. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox)
      2. Run: node --import tsx -e "import { runPayPalSetup } from './src/setup-paypal.js'; await runPayPalSetup()"
      3. Read ~/.clawpay/config.json
      4. Assert: paypal.clientId and paypal.clientSecret are present
    Expected Result: Credentials persisted
    Evidence: .sisyphus/evidence/task-6-setup-success.txt

  Scenario: Invalid credentials rejected
    Tool: Bash
    Steps:
      1. Set PAYPAL_CLIENT_ID=bad, PAYPAL_CLIENT_SECRET=bad
      2. Run: node --import tsx -e "import { runPayPalSetup } from './src/setup-paypal.js'; await runPayPalSetup()"
      3. Assert: error message displayed, credentials NOT saved
    Expected Result: Graceful rejection
    Evidence: .sisyphus/evidence/task-6-setup-fail.txt
  ```

  **Commit**: YES (groups with Task 5)
  - Message: `feat(paypal): add PayPal REST API client and setup flow`
  - Files: `src/setup-paypal.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 7. Installer PayPal Extension

  **What to do**:
  - Update `src/installer.ts` `runInstall()` to:
    - After Stripe key prompt, ask: "Do you also want to set up PayPal? (optional)" 
    - If yes: prompt for PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET
    - If no: skip PayPal setup
    - When patching MCP client configs, include PayPal env vars if provided
  - Update `runUninstall()` to clean up PayPal env vars from MCP configs

  **Must NOT do**:
  - Do NOT make PayPal mandatory — it must be optional
  - Do NOT break existing Stripe-only install flow

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: Task 10
  - **Blocked By**: Task 1

  **References**:
  - `src/installer.ts` — Current installer (lines 110-238). Extend `runInstall()` and `runUninstall()`
  - MCP config format for env vars: `"environment": { "PAYPAL_CLIENT_ID": "...", "PAYPAL_CLIENT_SECRET": "..." }`

  **Acceptance Criteria**:
  - [ ] PayPal setup is optional (can skip)
  - [ ] Stripe-only install still works unchanged
  - [ ] PayPal env vars added to MCP configs when provided
  - [ ] `tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Install with Stripe only (PayPal skipped)
    Tool: Bash
    Steps:
      1. Run installer with Stripe key only, decline PayPal
      2. Check MCP config files
      3. Assert: Stripe key present, no PayPal keys
    Expected Result: Stripe-only config
    Evidence: .sisyphus/evidence/task-7-stripe-only.txt

  Scenario: Install with both Stripe and PayPal
    Tool: Bash
    Steps:
      1. Run installer with both keys
      2. Check MCP config files
      3. Assert: Both Stripe and PayPal keys present
    Expected Result: Dual provider config
    Evidence: .sisyphus/evidence/task-7-both.txt
  ```

  **Commit**: YES
  - Message: `feat(installer): add optional PayPal credential collection`
  - Files: `src/installer.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 8. README + Badge Update

  **What to do**:
  - Add PayPal badge to README.md badge row: `[![PayPal](https://img.shields.io/badge/PayPal-Powered-003087.svg)](https://paypal.com)`
  - Add "PayPal P2P Sending" section to README:
    - How to set up PayPal: `clawpay install` or manual env vars
    - New MCP tools: `setup_paypal`, `send_paypal` with parameter tables
    - PayPal-specific guardrails
  - Update Quick Start to mention PayPal as optional
  - Update Manual Configuration with PayPal env vars example
  - Keep "zero card contact" note — still applies (PayPal handles all card/account data)
  - package.json: bump version to 0.2.0, update description to mention PayPal, add "paypal" keyword

  **Must NOT do**:
  - Do NOT remove any existing Stripe documentation
  - Do NOT add Korean text
  - Do NOT add unnecessary badges — only the PayPal badge

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 12
  - **Blocked By**: None (can start immediately based on planned tool specs)

  **References**:
  - `README.md` — Current README structure (follow existing patterns)
  - `package.json` — Version bump to 0.2.0, add "paypal" keyword
  - Current badges: CI, Coverage, License, Stripe, MCP — add PayPal after Stripe

  **Acceptance Criteria**:
  - [ ] PayPal badge renders correctly on GitHub
  - [ ] `setup_paypal` and `send_paypal` documented with parameter tables
  - [ ] package.json version is 0.2.0
  - [ ] "paypal" in keywords array
  - [ ] No Korean text

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: PayPal badge renders
    Tool: Bash
    Steps:
      1. Run: curl -s -o /dev/null -w "%{http_code}" "https://img.shields.io/badge/PayPal-Powered-003087.svg"
      2. Assert: HTTP 200
    Expected Result: Badge URL is valid
    Evidence: .sisyphus/evidence/task-8-badge.txt

  Scenario: package.json version is 0.2.0
    Tool: Bash
    Steps:
      1. Run: node -e "console.log(require('./package.json').version)"
      2. Assert: output is "0.2.0"
    Expected Result: Version bumped
    Evidence: .sisyphus/evidence/task-8-version.txt
  ```

  **Commit**: YES
  - Message: `docs: add PayPal badge and dual-payment documentation`
  - Files: `README.md`, `package.json`
  - Pre-commit: none

- [ ] 9. MCP Server Tool Registration

  **What to do**:
  - Update `src/index.ts` to register 2 new MCP tools:
    - `setup_paypal` — No params. Calls `runPayPalSetup()`. Returns success/error message.
    - `send_paypal` — Params: recipientEmail (string, optional), recipientPhone (string, optional), amount (integer, cents), currency (string, default "usd"), note (string, optional). One of recipientEmail or recipientPhone required. Calls `sendMoney()`. Returns `SendMoneyResult`.
  - Add tool definitions with inputSchema (JSON Schema) following existing pattern
  - Add tool handlers in the `CallToolRequestSchema` handler

  **Must NOT do**:
  - Do NOT rename existing Stripe tools (backward compatibility)
  - Do NOT add interactive prompts during tool execution
  - Do NOT modify existing tool handlers

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential after Wave 2)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 5, 6

  **References**:
  - `src/index.ts` — Current MCP tool definitions (lines 97-158) and handlers (lines 160-220). Follow exact same pattern for new tools
  - `src/paypal.ts` — `sendMoney()` function (Task 5)
  - `src/setup-paypal.ts` — `runPayPalSetup()` function (Task 6)
  - MCP SDK tool definition pattern: `{ name, description, inputSchema }`

  **Acceptance Criteria**:
  - [ ] MCP server lists 7 tools (5 existing + 2 new)
  - [ ] `setup_paypal` tool has correct schema (no params)
  - [ ] `send_paypal` tool has correct schema (amount, recipientEmail/Phone, currency, note)
  - [ ] `tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: MCP server lists 7 tools
    Tool: Bash
    Steps:
      1. Start MCP server and send tools/list request
      2. Parse JSON response
      3. Assert: 7 tools: setup_payment, pay, get_balance, list_transactions, refund, setup_paypal, send_paypal
    Expected Result: All 7 tools present
    Evidence: .sisyphus/evidence/task-9-tools-list.txt

  Scenario: send_paypal schema validation
    Tool: Bash
    Steps:
      1. From tools/list response, find send_paypal
      2. Assert: inputSchema has properties: recipientEmail (string), recipientPhone (string), amount (integer), currency (string), note (string)
      3. Assert: amount is required
    Expected Result: Correct JSON Schema
    Evidence: .sisyphus/evidence/task-9-schema.txt
  ```

  **Commit**: YES
  - Message: `feat(mcp): register setup_paypal and send_paypal tools`
  - Files: `src/index.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 10. Integration Tests

  **What to do**:
  - Extend `test/integration.test.ts` with PayPal test suites:
    - **PayPal Config Tests**: isPayPalConfigured, loadConfig with PayPal, env var override
    - **PayPal Audit Tests**: auditPayPalSend entry format, email/phone masking
    - **PayPal Guardrails Tests**: per-transaction limit applies to PayPal, daily limit applies to PayPal, currency restriction applies to PayPal
    - **PayPal Type Tests**: SendMoneyRequest validation, SendMoneyResult structure
    - **MCP Server Tests**: tools/list returns 7 tools (update existing test from 5 to 7), verify setup_paypal and send_paypal schemas
    - **Security Scan**: no hardcoded PayPal credentials
  - Mock PayPal API calls (do NOT make real API calls in tests — same pattern as Stripe mocking)
  - Maintain 100% code coverage across all metrics

  **Must NOT do**:
  - Do NOT make real PayPal API calls in tests
  - Do NOT reduce existing Stripe test coverage
  - Do NOT skip any edge cases

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 9)
  - **Blocks**: Tasks 11, 12
  - **Blocked By**: Tasks 5, 6, 7, 9

  **References**:
  - `test/integration.test.ts` — Current test suite (342 lines). Follow exact same patterns: describe blocks, mock setup, assertion style
  - `src/paypal.ts` — Functions to test (Task 5)
  - `src/setup-paypal.ts` — Functions to test (Task 6)
  - `src/guardrails.ts` — `auditPayPalSend()` (Task 3)
  - `src/config.ts` — `isPayPalConfigured()` (Task 2)

  **Acceptance Criteria**:
  - [ ] All tests pass: `node --import tsx --test 'test/integration.test.ts'` → 0 failures
  - [ ] Coverage: `c8` → 100% statements, branches, functions, lines
  - [ ] PayPal-specific tests cover: config, audit, guardrails, MCP tools
  - [ ] No real API calls in tests

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. Run: node --import tsx --test 'test/integration.test.ts'
      2. Assert: exit code 0, all tests pass
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-10-tests.txt

  Scenario: 100% coverage maintained
    Tool: Bash
    Steps:
      1. Run: c8 --reporter=text node --import tsx --test 'test/integration.test.ts'
      2. Assert: Statements 100%, Branches 100%, Functions 100%, Lines 100%
    Expected Result: 100% all metrics
    Evidence: .sisyphus/evidence/task-10-coverage.txt
  ```

  **Commit**: YES
  - Message: `test: PayPal integration tests, maintain 100% coverage`
  - Files: `test/integration.test.ts`
  - Pre-commit: `node --import tsx --test 'test/integration.test.ts'`

- [ ] 11. CI Pipeline Update

  **What to do**:
  - Update `.github/workflows/ci.yml`:
    - Add PayPal sandbox credentials as environment variables for test jobs (use GitHub Secrets or dummy values)
    - Add security scan for hardcoded PayPal credentials (same pattern as Stripe scan)
    - Ensure coverage gate still enforces 90%+ threshold
  - Add `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` patterns to security scan regex

  **Must NOT do**:
  - Do NOT commit real PayPal credentials
  - Do NOT break existing CI for Stripe

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 10)
  - **Blocks**: Task 12
  - **Blocked By**: Task 10

  **References**:
  - `.github/workflows/ci.yml` — Current CI config. Extend security scan section
  - Current security scan pattern: `sk_(live|test)_[a-zA-Z0-9]{20,}` — add PayPal equivalent

  **Acceptance Criteria**:
  - [ ] Security scan checks for hardcoded PayPal credentials
  - [ ] CI passes with PayPal tests
  - [ ] Coverage gate still active

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: CI config is valid YAML
    Tool: Bash
    Steps:
      1. Run: node -e "const yaml = require('yaml'); yaml.parse(require('fs').readFileSync('.github/workflows/ci.yml', 'utf8')); console.log('valid')"
      2. Assert: output is "valid"
    Expected Result: Valid YAML
    Evidence: .sisyphus/evidence/task-11-yaml.txt
  ```

  **Commit**: YES (groups with Task 12)
  - Message: `chore: update CI for PayPal tests and security scan`
  - Files: `.github/workflows/ci.yml`
  - Pre-commit: none

- [ ] 12. npm Publish v0.2.0

  **What to do**:
  - Verify all tests pass and coverage is 100%
  - Build: `npm run build`
  - Verify dist/ output is correct
  - Publish: `npm publish` (package.json already bumped to 0.2.0 in Task 8)
  - Verify on npm: `npm view @xodn348/clawpay@0.2.0`
  - Git tag: `git tag v0.2.0`
  - Git push: `git push origin main --tags`

  **Must NOT do**:
  - Do NOT publish if tests fail
  - Do NOT publish if coverage < 100%

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final, after Task 11)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 10, 11

  **References**:
  - `package.json` — Version 0.2.0 (set in Task 8)
  - npm account: `xodn348` — already logged in
  - Previous publish: `@xodn348/clawpay@0.1.1`

  **Acceptance Criteria**:
  - [ ] `npm view @xodn348/clawpay@0.2.0` → package info displayed
  - [ ] git tag v0.2.0 exists
  - [ ] All tests pass before publish

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: npm package published successfully
    Tool: Bash
    Steps:
      1. Run: npm view @xodn348/clawpay@0.2.0 version
      2. Assert: output is "0.2.0"
    Expected Result: Package live on npm
    Evidence: .sisyphus/evidence/task-12-npm.txt

  Scenario: Git tag exists
    Tool: Bash
    Steps:
      1. Run: git tag -l "v0.2.0"
      2. Assert: output contains "v0.2.0"
    Expected Result: Tag created
    Evidence: .sisyphus/evidence/task-12-tag.txt
  ```

  **Commit**: YES
  - Message: `chore: publish @xodn348/clawpay@0.2.0 to npm`
  - Files: none (publish only)
  - Pre-commit: `npm test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `node --import tsx --test 'test/integration.test.ts'`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real MCP QA** — `unspecified-high`
  Start ClawPay MCP server. Call `tools/list` — verify 7 tools present with correct schemas. Test each PayPal tool with mock/sandbox data. Verify error handling for missing credentials.
  Output: `Tools [7/7] | Schemas [VALID/INVALID] | Error Handling [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(types): add PayPal type definitions and config support` — types.ts, config.ts, guardrails.ts
- **Wave 2**: `feat(paypal): add PayPal REST API client and setup flow` — paypal.ts, setup-paypal.ts, installer.ts
- **Wave 2**: `docs: add PayPal badge and dual-payment documentation` — README.md
- **Wave 3**: `feat(mcp): register setup_paypal and send_paypal tools` — index.ts
- **Wave 3**: `test: PayPal integration tests, maintain 100% coverage` — integration.test.ts
- **Wave 3**: `chore: publish @xodn348/clawpay@0.2.0` — package.json, ci.yml

---

## Success Criteria

### Verification Commands
```bash
tsc --noEmit                    # Expected: 0 errors
node --import tsx --test 'test/integration.test.ts'  # Expected: all pass
c8 --reporter=text node --import tsx --test 'test/integration.test.ts'  # Expected: 100% all metrics
node -e "import('./dist/index.js')"  # Expected: MCP server starts
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (100% coverage)
- [ ] 7 MCP tools listed (5 Stripe + 2 PayPal)
- [ ] PayPal badge in README
- [ ] npm published as @xodn348/clawpay@0.2.0
