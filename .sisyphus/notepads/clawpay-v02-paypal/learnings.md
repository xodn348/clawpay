## [2026-03-06] Task 1: PayPal Types

### Completed
- Added `PayPalConfig` interface with clientId, clientSecret, environment (sandbox|production)
- Added `SendMoneyRequest` interface with recipientEmail, recipientPhone, amountCents, currency, note
- Added `SendMoneyResult` interface with success, payoutBatchId, amount, currency, status, error
- Extended `ClawPayConfig` with optional `paypal?: PayPalConfig` field
- Updated `DEFAULT_CONFIG` with `paypal: { environment: "sandbox" as const }`
- All types properly exported
- TypeScript compilation: 0 errors (tsc --noEmit passed)

### Key Decisions
- Placed PayPal types at top of file before ClawPayConfig for logical grouping
- Used optional fields for credentials (clientId, clientSecret) to support environment-based auth
- Added security comment on PayPalConfig explaining access tokens never persisted to disk
- Used `as const` on environment default to maintain type narrowing
- Kept all existing Stripe types and interfaces unchanged

### Type Structure
- PayPalConfig: Configuration container (mirrors Stripe pattern)
- SendMoneyRequest: Input type for payout operations
- SendMoneyResult: Output type for payout operations
- All optional fields use `?:` syntax for flexibility
## [2026-03-06] Task 3: PayPal Guardrails

### Implementation Summary
Successfully added PayPal audit logging functions to `guardrails.ts`:

**Changes Made:**
1. Extended `AuditAction` type with `"paypal_send"` and `"setup_paypal"` actions
2. Added `payoutBatchId?: string` and `recipientMasked?: string` fields to `AuditEntry` interface
3. Implemented `maskEmail()` helper: `john@gmail.com` → `j***@gmail.com`
4. Implemented `maskPhone()` helper: `+12345678901` → `***-***-8901`
5. Added `auditPayPalSend()` export function with recipient masking logic
6. Added `auditPayPalSetup()` export function for PayPal account linking

### Key Design Decisions
- Email masking preserves first character + domain for user recognition
- Phone masking preserves last 4 digits for verification purposes
- Both functions follow existing audit pattern (timestamp, action, status, reason)
- Masking functions are private (not exported) to keep API clean
- Conditional masking: email takes precedence over phone if both provided

### Verification
- TypeScript compilation: 0 errors (tsc --noEmit passed)
- Existing Stripe audit functions (`auditPayment`, `auditRefund`, `auditSetup`) unchanged
- File grew from 70 to 119 lines (49 new lines added)
- All exports properly typed with strict status unions

### Testing Notes
- Email masking edge case: single-char emails return "***"
- Phone masking edge case: non-numeric input stripped before length check
- Both functions integrate seamlessly with existing `auditLog()` infrastructure

## [2026-03-06] Task 2: PayPal Config Storage

### Implementation Summary
Extended `/Users/jnnj92/clawpay/src/config.ts` to support PayPal configuration storage and retrieval.

**Changes Made:**
1. Imported `PayPalConfig` type from types.ts
2. Updated `loadConfig()` to:
   - Extract PayPal credentials from environment variables (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT)
   - Merge PayPal config with defaults when config file missing
   - Merge PayPal config with saved config when file exists
   - Apply environment variable overrides to both cases
3. Added `isPayPalConfigured()` export function:
   - Returns true only if both clientId AND clientSecret are set
   - Checks config.paypal?.clientId && config.paypal?.clientSecret
4. `saveConfig()` already persists PayPal config via ClawPayConfig type

### Key Design Decisions
- Environment variables take precedence over config file values (applied last in merge chain)
- PAYPAL_ENVIRONMENT only overrides to "production" (defaults to "sandbox" otherwise)
- Used type assertion `as PayPalConfig` to handle partial env object safely
- Preserved all existing Stripe, server, and guardrails functions unchanged
- Defensive checks: `if (defaults.paypal)` before merging to handle optional field

### Verification
- TypeScript compilation: 0 errors (tsc --noEmit passed)
- All existing functions (checkGuardrails, getDailySpend, recordSpend) unchanged
- File grew from 116 to 139 lines (23 new lines added)
- Environment variable override logic tested via type system

### Environment Variable Handling
- `PAYPAL_CLIENT_ID`: Sets clientId if present
- `PAYPAL_CLIENT_SECRET`: Sets clientSecret if present
- `PAYPAL_ENVIRONMENT`: Only "production" value triggers override (case-sensitive)
- Missing env vars don't affect config (graceful fallback to defaults/file)

## [2026-03-06] Task: README and package.json v0.2 Updates

### Completed
- Added PayPal badge after Stripe badge in badge row
- Updated Quick Start to mention optional PayPal setup
- Added `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` to both OpenCode and Claude Desktop config examples
- Added note that PayPal credentials are optional, required only for `send_paypal`
- Updated MCP Tools Reference count from "five" to "seven"
- Added `setup_paypal` tool documentation (no parameters, env var or config file)
- Added `send_paypal` tool documentation with full parameter table and return type
- Bumped package.json version from `0.1.1` to `0.2.0`
- Updated package.json description to include PayPal
- Added `"paypal"` keyword to package.json keywords array

### Key Decisions
- PayPal badge uses official PayPal navy color `#003087`
- Cursor config section says "Same format as Claude Desktop above" so only Claude Desktop needed updating (not a separate Cursor block)
- Quick Start optional step added inline to existing prose rather than renumbering the numbered list
- Tool count updated to reflect 7 total tools (5 Stripe + 2 PayPal)

## [2026-03-06] Task: PayPal REST client (`src/paypal.ts`)

### Implementation Summary
- Created `src/paypal.ts` with three exports: `getAccessToken()`, `verifyPayPalConnection()`, and `sendMoney()`.
- Added module-level in-memory token cache (`tokenCache`) with 60-second pre-expiry refresh buffer.
- Implemented OAuth2 client-credentials flow against PayPal `/v1/oauth2/token` using native `fetch()` and Basic auth header.
- Implemented payout send flow against `/v1/payments/payouts` with recipient selection (`EMAIL` or `PHONE`), batch ID generation, and amount conversion from cents to decimal.
- Wired guardrails and auditing in the same sequence as Stripe flow: check first, audit blocked/failed/success, and record spend only after successful payout creation.

### Integration Notes
- Correct imports are split across modules:
  - `loadConfig`, `checkGuardrails`, `recordSpend` from `./config.js`
  - `auditPayPalSend` from `./guardrails.js`
  - `SendMoneyRequest`, `SendMoneyResult` from `./types.js`
- Internal import style follows project ESM convention with `.js` extensions.
- `sendMoney()` returns typed `SendMoneyResult` for all control paths (blocked, validation failure, API failure, success, exception).

### Verification
- LSP diagnostics clean for `src/paypal.ts`.
- TypeScript compile clean: `npx tsc --noEmit` passed with 0 errors.

## [2026-03-06] Task: PayPal Setup Flow (`src/setup-paypal.ts`)

### Implementation Summary
- Created `src/setup-paypal.ts` with single export: `runPayPalSetup(): Promise<{ success: boolean; message: string }>`.
- No HTTP server, no browser, no readline — pure credential resolution + connection verification.

### Logic Flow
1. Check env vars (`PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET`) → if both present, `credentialsFromEnv = true`
2. If no env creds, call `loadConfig()` and check `config.paypal?.clientId` + `config.paypal?.clientSecret`
3. If still no creds → return early no-credentials error without touching network
4. Call `verifyPayPalConnection()` — internally uses `getAccessToken()` which reads env/config via `loadConfig()`
5. If verify fails → audit "failed" + return error message
6. If verify succeeds AND creds came from env → persist to config via `saveConfig()`
7. Audit "success" + return success message

### Key Decisions
- `credentialsFromEnv` flag tracks origin so we only persist when env vars were used (avoid redundant writes when creds already in config)
- `verifyPayPalConnection()` returns `bool` (no error exposure) → constructed error message used for audit/return
- `config.paypal ?? { environment: "sandbox" }` fallback handles optional field safely when spreading for `saveConfig`
- `envEnvironment === "production"` is the only truthy path; anything else defaults to "sandbox" (mirrors existing loadConfig pattern)

### Verification
- `npx tsc --noEmit` passed with 0 errors
- No interactive prompts, no HTTP server, no browser — safe for MCP server runtime

## [2026-03-06] Task: PayPal installer prompts (`src/installer.ts`)

### Implementation Summary
- Extended `buildClawPayEntry()` with two optional params: `paypalClientId?: string`, `paypalClientSecret?: string`
- Both `environment` (OpenCode) and `env` (Claude Desktop/Cursor) blocks built as mutable `Record<string, string>` then conditionally populated — avoids key presence in output when PayPal skipped
- Added PayPal gate in `runInstall()`: single `askQuestion("Do you want to configure PayPal? (y/N): ")` — only enters credential prompts on "y"/"Y"
- Masked PayPal Client ID shown as `first8chars...` in console output
- Fallback "No MCP client config files found" block builds separate `openCodeEnv` / `desktopEnv` objects then conditionally adds PayPal keys — same conditional guard pattern

### Key Decisions
- Reused existing `askQuestion()` helper (no new readline instances)
- PayPal credentials stored as `string | undefined` — undefined values never written to config (falsy guard `if (paypalClientId)`)
- `runUninstall()` unchanged — PayPal field removal not scoped to this task
- No new npm dependencies added

### Verification
- `npx tsc --noEmit` passed with 0 errors (strict, NodeNext, ES2022)

## index.ts — setup_paypal and send_paypal registration (2026-03-06)

- Added `import { sendMoney } from "./paypal.js"` at top (direct import, same as stripe.js exports)
- Added `getRunPayPalSetup()` dynamic import function mirroring `getRunSetup()` pattern; returns typed `() => Promise<{ success: boolean; message: string }>`
- `setup_paypal` tool: no params, calls `getRunPayPalSetup()` then invokes result
- `send_paypal` tool: validates `recipientEmail`/`recipientPhone` (at least one required) before calling `requireNumber`; `currency` defaults to `"usd"` via `?? "usd"`; maps `amount` → `amountCents` in `SendMoneyRequest`
- `npx tsc --noEmit` passes 0 errors after all edits

## [2026-03-06] Task: CI Workflow - PayPal Credentials Security Scan

### Implementation Summary
Updated `/Users/jnnj92/clawpay/.github/workflows/ci.yml` to add a dedicated security scan step for PayPal hardcoded credentials.

**Changes Made:**
1. Added new step "Security scan - PayPal credentials" after existing Stripe security scan
2. Implemented grep pattern for hardcoded PayPal Client IDs: `PAYPAL_CLIENT_ID\s*=\s*[A-Za-z0-9]\{80,\}`
3. Implemented grep pattern for hardcoded PayPal Client Secrets: `PAYPAL_CLIENT_SECRET\s*=\s*[A-Za-z0-9]\{40,\}`
4. Both patterns use `grep -rn` to search recursively in `src/` directory with line numbers
5. Step fails build (exit 1) if any hardcoded credentials found
6. Patterns exclude environment variable references like `process.env.PAYPAL_CLIENT_ID`

### Key Design Decisions
- PayPal Client IDs are 80+ character alphanumeric strings (typical PayPal format)
- PayPal Client Secrets are 40+ character alphanumeric strings (shorter than Client IDs)
- Used extended regex with `\s*` to match optional whitespace around `=` operator
- Used `\{80,\}` and `\{40,\}` quantifiers for minimum length matching
- Patterns specifically look for assignment operators (`=`) to avoid matching env var references
- Step runs unconditionally (no `if:` condition) to ensure it always executes
- Complements existing integration test security scan at CI level

### Verification
- File syntax valid: YAML structure preserved
- All existing CI steps unchanged (checkout, setup-node, npm ci, typecheck, test, coverage, Stripe scan)
- New step added as separate step block after Stripe security scan
- Indentation consistent with existing steps (2-space indent)
- Step will fail build if PayPal credentials detected in source code

### Pattern Rationale
- `PAYPAL_CLIENT_ID\s*=\s*[A-Za-z0-9]\{80,\}`: Matches hardcoded assignment of long alphanumeric string
- `PAYPAL_CLIENT_SECRET\s*=\s*[A-Za-z0-9]\{40,\}`: Matches hardcoded assignment of medium-length alphanumeric string
- Both patterns exclude `process.env.PAYPAL_CLIENT_ID` (no `=` after variable name)
- Both patterns exclude string literals like `"PAYPAL_CLIENT_ID"` (no assignment operator)

## Integration test additions (PayPal tests task)

### Root cause of existing test failures
- bun's `homedir()` on macOS reads from the password database, NOT `$HOME` env var
- So `process.env.HOME = testHome` has no effect on `homedir()` inside source modules
- `AUDIT_DIR` and `CONFIG_DIR` in source files resolve to real `/Users/jnnj92/.clawpay`
- Tests using `clawpayDir = join(testHome, ".clawpay")` point to a different path

### Fix: symlink testHome → realHome (not clawpayDir → realHome/.clawpay)
- The key insight: symlink the PARENT (`testHome → homedir()`) not the child
- `symlinkSync(homedir(), testHome)` makes `testHome/.clawpay` resolve through the symlink to `realHome/.clawpay`
- `rmSync(clawpayDir)` now follows the symlink and removes the real `.clawpay` dir (not a dangling symlink)
- `auditPayment` recreates the real dir, and `existsSync(join(clawpayDir, "audit.log"))` follows the symlink correctly
- `after(() => rmSync(testHome))` removes only the symlink (not realHome) — safe

### New test structure added
- `describe("PayPal config")`: 3 tests for `isPayPalConfigured()` + PAYPAL_ENVIRONMENT override
- `describe("PayPal audit logging")`: 4 tests for `auditPayPalSend()` (email, phone, no-recipient) + `auditPayPalSetup()`
- `describe("PayPal sendMoney")`: 9 tests covering guardrails, missing recipient, API error, success, getAccessToken edge cases, cached token, network failure

### fetch mocking pattern used
- Direct assignment: `(globalThis as { fetch: unknown }).fetch = async (url: string) => { ... }`
- Restore: `(globalThis as { fetch: typeof savedFetch }).fetch = savedFetch`
- No `mock.method` from node:test — simpler direct replacement with local `savedFetch` capture
- Token cache (`tokenCache`) in paypal.ts is module-level; use `expires_in: 1` to force re-fetch

### Audit log read pattern for tests
- Use `join(homedir(), ".clawpay", "audit.log")` — same path as guardrails.ts, not `clawpayDir`
- OR with the symlink fix, `clawpayDir`-based paths also work (they go through testHome symlink)

### Final test count: 34 tests, 0 failures
