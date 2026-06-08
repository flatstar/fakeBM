---
phase: 01-db
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - app/(boot)/_components/SessionBoot.tsx
  - app/(boot)/page.tsx
  - app/(mini)/_components/WelcomeIntro.tsx
  - app/(mini)/home/page.tsx
  - app/(mini)/layout.tsx
  - app/api/session/route.ts
  - app/fonts.ts
  - app/globals.css
  - app/layout.tsx
  - app/share/page.tsx
  - components/Avatar.tsx
  - components/Body.tsx
  - components/BottomNav.tsx
  - components/Burst.tsx
  - components/Card.tsx
  - components/FoodTile.tsx
  - components/Icon.tsx
  - components/Money.tsx
  - components/StatBadge.tsx
  - components/SubBar.tsx
  - components/TgHeader.tsx
  - components/TgMainButton.tsx
  - db/schema.ts
  - drizzle.config.ts
  - lib/auth.ts
  - lib/catalog.ts
  - lib/db.ts
  - lib/format.ts
  - lib/telegram.ts
  - next.config.ts
  - proxy.ts
  - tests/api/session.test.ts
  - tests/auth/dev-mock-guard.test.ts
  - tests/auth/expiry.test.ts
  - tests/auth/first-open-bootstrap.test.ts
  - tests/auth/protected-redirect.test.ts
  - tests/auth/public-open.test.ts
  - tests/auth/session.test.ts
  - tests/auth/verify-initdata.test.ts
  - tests/db/schema.test.ts
  - tests/db/users-upsert.test.ts
  - tests/fixtures/initdata.ts
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

This is the auth + DB walking skeleton for a Telegram Mini App. I reviewed the
security-sensitive auth surface (`lib/auth.ts`, `app/api/session/route.ts`,
`proxy.ts`, `app/(mini)/layout.tsx`, `SessionBoot.tsx`, `lib/db.ts`) most
aggressively, then the design-system components and tests.

The core auth design is sound: secrets are server-only with no `NEXT_PUBLIC_`
leakage anywhere, `verifyInitData` delegates HMAC+expiry to
`@telegram-apps/init-data-node`, `devMockUser` is hard-guarded to
`NODE_ENV==='development'`, the JWT round-trip is correct, and `upsertUser` uses
parameterized Drizzle (no SQL injection surface). The first-open redirect-loop
fix is structurally intact.

However, there is one **BLOCKER**: the proxy auth matcher uses prefix-based
negative lookaheads, so any future route whose path *starts with* `share` or
`api` (e.g. `/share-admin`, `/api-internal`) silently escapes the coarse auth
redirect — an auth-surface widening waiting to happen. Several tests assert
weaker properties than the security claims they advertise (false confidence),
and there are correctness gaps around session-establishment retry and JWT uid
validation.

## Critical Issues

### CR-01: Proxy auth matcher excludes by prefix, not exact segment — silent auth-surface widening

**File:** `proxy.ts:28`
**Issue:** The matcher negative lookahead
`'/((?!api|_next/static|_next/image|share|favicon.ico|$).*)'` matches the
*start* of the path, not a whole segment. Verified empirically:

```
/share      → not guarded (intended, public)
/sharexyz   → not guarded   ← UNINTENDED
/shared     → not guarded   ← UNINTENDED
/api        → not guarded
/apixyz     → not guarded   ← UNINTENDED
```

Any future route named `/share*` or `/api*` (e.g. an admin `/share-config`
page, or a non-`/api`-prefixed handler) will silently bypass the coarse
redirect. The `(mini)` layout guard is the authoritative boundary and would
still protect routes physically nested under `app/(mini)/`, but a public-group
page named `/shareXYZ` would render with no session and no redirect — exactly
the failure the matcher exists to prevent. This is a latent authorization gap
baked into the regex, and the existing tests (`public-open.test.ts`,
`first-open-bootstrap.test.ts`) only ever probe the exact strings `/share` and
`/home`, so they would not catch the regression.

**Fix:** Anchor each exclusion to a full segment by requiring a following `/` or
end-of-string:

```ts
export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next/static|_next/image|share(?:/|$)|favicon.ico|$).*)',
  ],
};
```

Then add a test asserting `/sharexyz` and `/apixyz` ARE matched (guarded).

## Warnings

### WR-01: `readSession` accepts any numeric `uid`, including 0, NaN-free but unvalidated negatives/floats

**File:** `lib/auth.ts:72-73`
**Issue:** `readSession` returns the uid when `typeof uid === 'number'`. A token
signed (by anything holding `SESSION_SECRET`) with `uid: 0`, `uid: -1`, or
`uid: 1.5` is accepted as a valid session id. Telegram ids are positive
integers; a non-positive or non-integer uid downstream (e.g. as a DB key in a
later phase) is a malformed-identity bug. While forging requires the secret
(so not an external bypass today), the contract "valid session ⇒ valid Telegram
uid" is not enforced at the trust boundary.

**Fix:**

```ts
const uid = payload.uid;
return typeof uid === 'number' && Number.isInteger(uid) && uid > 0 ? uid : null;
```

### WR-02: SessionBoot retry on transient failure relies on a remount that never comes

**File:** `app/(boot)/_components/SessionBoot.tsx:38,48,51`
**Issue:** On `!raw`, a non-`res.ok` response, or a thrown error, the code sets
`started.current = false` "to let a remount retry." But the `useEffect` has a
`[router]` dependency and the component never unmounts on this static page, so
the effect does not re-run — resetting the ref does nothing. A user who opens
before launch params are ready (the `!raw` path the comment explicitly
anticipates), or who hits a transient 5xx, is stuck on the "여는 중…" splash with
no retry and no error UI. The "let a remount retry" comment is misleading: there
is no remount trigger.

**Fix:** Implement an explicit bounded retry (e.g. poll `retrieveRawInitData`
with a short interval / attempt counter inside the effect, or re-run via a state
counter), or surface a visible "다시 시도" affordance on failure. At minimum,
correct the comment so the dead retry isn't mistaken for working recovery.

### WR-03: `tests/setup.ts` loads `.env.local` and reuses any real `SESSION_SECRET` from it

**File:** `tests/setup.ts:22-30`
**Issue:** Setup calls `process.loadEnvFile('.env.local')` and then sets
`process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? '...'`. If a
developer's `.env.local` contains the real production-style `SESSION_SECRET`,
the test run silently keys its JWTs off that real secret instead of the
throwaway. The file header claims "SESSION_SECRET is a throwaway test key — NEVER
a real production secret," but the `??` makes that false whenever `.env.local`
defines it. `BOT_TOKEN` is correctly hard-overridden; `SESSION_SECRET` should be
too, for the same reason (deterministic, isolated tests + no real secret in the
test path).

**Fix:** Hard-assign the test secret unconditionally:

```ts
process.env.SESSION_SECRET = 'test-session-secret-not-for-prod-0123456789';
```

### WR-04: `next/headers` cookies mock returns `get: () => undefined` — never exercises a real cookie roundtrip

**File:** `tests/api/session.test.ts:21` (asserting on `route.ts:66-73`)
**Issue:** The session route test mocks `cookies()` so `get` always returns
`undefined` and `set` is a spy. The test asserts the cookie *options*
(`httpOnly/secure/sameSite/partitioned/path`) but never that `maxAge` is set
(see WR-05) and never that the written JWT actually decodes to the upserted uid.
It validates attribute shape, not that the issued session is the one that would
authenticate the user. This is weaker than the AUTH-04 claim ("the __session
cookie carries the verified uid").

**Fix:** Capture the `value` written to `cookieSet` and assert
`await readSession(value) === 99281932`, closing the loop from initData → cookie
→ recoverable session.

### WR-05: Cookie `maxAge` (3600s) is duplicated as a magic number and untested; drifts from `SESSION_TTL`

**File:** `app/api/session/route.ts:72` and `lib/auth.ts:19`
**Issue:** The cookie `maxAge: 60 * 60` is hand-written in the route, while the
JWT lifetime is `SESSION_TTL = 60 * 60` in `lib/auth.ts`. These two must agree
(cookie should not outlive the JWT, nor expire well before it) but are
independent literals with no shared constant — a future change to `SESSION_TTL`
will silently desync the cookie lifetime. The session test's `toMatchObject`
does not even assert `maxAge`, so the drift is invisible to CI.

**Fix:** Export `SESSION_TTL` from `lib/auth.ts` and use it for the cookie
`maxAge`; add `maxAge: 3600` to the test's `toMatchObject` assertion.

### WR-06: `first-open-bootstrap.test.ts` probes `/?reauth=1` through a path regex — a false-confidence assertion path

**File:** `tests/auth/first-open-bootstrap.test.ts:33-36` and the surrounding
suite comment
**Issue:** The suite reasons about the re-auth landing `/?reauth=1` not being
trapped, but Next.js matchers run against the **pathname only** (`/`), never the
query string. The test correctly checks `/` (not `/?reauth=1`) against the
regex, but the suite's own header comment frames the guarantee in terms of
`/?reauth=1`, and `protected-redirect.test.ts`/`public-open.test.ts` compile the
matcher with a hand-rolled `^...$` wrapper (`compileMatcher`) that is an
*approximation* of Next's compilation, not Next's actual behavior. The tests
therefore assert against a reviewer's model of the matcher, not the matcher as
Next applies it — they would not catch CR-01-class segment-boundary bugs, and
give false confidence that the public/guarded split is verified.

**Fix:** Either import Next's actual matcher compilation, or expand the regex
tests to include the prefix-collision cases (`/sharexyz`, `/apixyz`) so the
suite at least pins the real segment-boundary semantics. Align the comment to
say the guarantee is about pathname `/`, not the query string.

### WR-07: `verifyInitData` claim of "rejects forged/expired" is only asserted with `.toThrow()` (untyped)

**File:** `tests/auth/verify-initdata.test.ts:23`, `tests/auth/expiry.test.ts:15`
**Issue:** Both HIGH-gate tests assert only `expect(() => ...).toThrow()` with no
error type. A future refactor that throws for an *unrelated* reason (e.g. a
parse error, a missing env var, a thrown `TypeError` because `BOT_TOKEN` is
undefined) would keep these tests green while the actual signature/expiry
rejection logic is broken. For a block-on-HIGH security gate, asserting the
*reason* matters: a generic throw is indistinguishable from an accidental crash.

**Fix:** Assert the specific error classes from
`@telegram-apps/init-data-node` (e.g.
`.toThrow(SignatureInvalidError)` and `.toThrow(ExpiredError)`), so the test
proves *why* it rejected, not merely that something threw.

## Info

### IN-01: `Avatar` hash applies `% AV_COLORS.length` every iteration — degenerate hash distribution

**File:** `components/Avatar.tsx:19`
**Issue:** `h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length` reduces modulo 7
on each character, so `h` is always `< 7` going into the next multiply. This is
not the classic `h*31+c` rolling hash (which mods once at the end) and produces a
much weaker color distribution. It is deterministic and stays in-range (no bug),
and the header says "ported verbatim," so behavior is intentional — flagging only
as a latent quality nit if color diversity ever matters.

**Fix (optional):** Mod once after the loop:
`let h = 0; for (const c of name||'') h = (h*31 + c.charCodeAt(0)) | 0; const bg = AV_COLORS[Math.abs(h) % AV_COLORS.length];`

### IN-02: Empty-string `BOT_TOKEN`/`SESSION_SECRET` masked by non-null assertions

**File:** `lib/auth.ts:25,49`, `lib/db.ts:21`
**Issue:** `process.env.SESSION_SECRET!` / `process.env.BOT_TOKEN!` /
`process.env.DATABASE_URL!` use TS non-null assertions. At runtime an unset or
empty-string env yields a confusing downstream failure (e.g. jose signing with a
zero-length key, or `neon('')`) rather than a clear "missing config" error. Not
exploitable, but a misconfiguration footgun for the deploy in plan 04.

**Fix:** Add a small `requireEnv(name)` helper that throws
`Missing env: ${name}` when falsy, and use it at these call sites.

### IN-03: `Card` and `FoodTile` use `onClick` on a non-button `<div>` without keyboard/role semantics

**File:** `components/Card.tsx:15`, (and clickable usages downstream)
**Issue:** `Card` attaches `onClick` to a `<div>` with `cursor:pointer` but no
`role="button"`, `tabIndex`, or key handler — not keyboard-accessible. Phase-1
placeholder, so low impact, but the pattern will propagate as cards become
interactive in Phase 2.

**Fix:** When `onClick` is provided, add `role="button"`, `tabIndex={0}`, and an
Enter/Space `onKeyDown`, or render a `<button>`.

### IN-04: External CDN `@import` for Pretendard is a third-party runtime dependency / supply-chain surface

**File:** `app/globals.css:6`
**Issue:** `@import url("https://cdn.jsdelivr.net/...pretendard.css")` pulls the
body font (used for the money HARD RULE tabular-nums) from a third-party CDN at
runtime. A CDN outage degrades the ₩-glyph rendering guarantee, and it adds a
network dependency inside the Telegram WebView. Display fonts are correctly
self-hosted via `next/font/local`; the body font is the inconsistent one.

**Fix:** Self-host Pretendard via `next/font/local` (or `next/font`) for parity
with the BM fonts and to remove the runtime CDN dependency.

### IN-05: `devMockUser` ignores its `req` parameter (prefixed `_req`) — dead parameter

**File:** `lib/auth.ts:99`
**Issue:** The `_req: Request` parameter is accepted "for future per-request mock
shaping" but is entirely unused. Harmless, but it is speculative API surface on
a security-critical function; the route already passes `req` to it
(`route.ts:49`). Keep only if the near-term plan actually consumes it.

**Fix:** Drop the parameter until it is used, or document the concrete
near-term consumer.

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
