---
phase: 03-wait-proof
reviewed: 2026-06-09T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - app/api/posts/route.ts
  - app/api/wait/[id]/arrive/route.ts
  - app/api/wait/[id]/start/route.ts
  - app/api/blob/upload/route.ts
  - db/schema.ts
  - lib/streak.ts
  - lib/wait.ts
  - lib/downscale.ts
  - app/(mini)/wait/[id]/page.tsx
  - app/(mini)/wait/[id]/_components/DeliveryClient.tsx
  - app/(mini)/wait/[id]/_components/Rider.tsx
  - app/(mini)/wait/[id]/_components/CancelModal.tsx
  - app/(mini)/post/[id]/page.tsx
  - app/(mini)/post/[id]/_components/PostClient.tsx
  - app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: fixed
fix:
  fixed_at: 2026-06-09
  warnings_fixed: 5
  warnings_skipped: 0
  info_fixed: 0
  resolved: [WR-01, WR-02, WR-03, WR-04, WR-05]
  note: >-
    WR-05 is a logic change (skip-vs-complete intent) — verified by tests but
    flagged for human confirmation. Full suite green (145 pass / 1 skip),
    tsc clean, build clean.
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 3 closes the core "order → wait → prove" loop. The server-authority spine is genuinely strong: every order read/write in the API routes and SC shells is owner-scoped on `and(eq(orders.id), eq(orders.tgId))`, the arrive judgement is computed from the server clock (`Date.now() >= waitDeadline.getTime()`), the deadline write is `isNull`-guarded against clock-reset re-entry, and the proof write is gated on owner + `arrivedAt` + `order_id` UNIQUE / `onConflictDoNothing`. The Phase-specific IDOR / spoofing risks the brief flagged are correctly defended. I could not find a Critical bug or an exploitable auth/IDOR gap.

The defects that remain are correctness/robustness issues rather than security holes. The most important is a client-side state bug in `DeliveryClient.callArrive`: its `finally` block flips `arrived = true` even when the server `arrive` POST throws, producing a UI that claims "참기 성공!" while the server never recorded arrival — sending the user into a redirect loop at `/post/[id]`. Secondary issues: the blob token route returns the raw error message to the client (contradicting its own "no leak" comment), upload pathnames are not per-user scoped despite the threat model claiming so, and several non-null assertions / silent-failure paths rely on invariants that should be asserted, not assumed.

## Warnings

### [RESOLVED] WR-01: `callArrive` reports arrival success even when the server POST fails

**File:** `app/(mini)/wait/[id]/_components/DeliveryClient.tsx:98-109`
**Issue:** The `finally` block unconditionally runs `setArrived(true)` after a failed `fetch`. The catch comment says "leave the screen as-is; re-tick will retry on deadline," but the `finally` overrides that — on any network error the client renders "🎉 참기 성공!" and the "인증하러 가기" MainButton, while `orders.arrivedAt` is still NULL on the server. When the user taps through, `app/(mini)/post/[id]/page.tsx:55` sees `!order.arrivedAt` and `redirect('/wait/${idNum}')` — a dead-end loop with no error surfaced. The display also stops re-ticking (the progress `useEffect` early-returns on `arrived`), so the deadline-retry the comment promises never happens.
**Fix:** Only mark arrived on success; surface failure so the user can retry.
```tsx
async function callArrive(): Promise<void> {
  if (arrived || posting) return;
  setPosting(true);
  try {
    const res = await fetch(`/api/wait/${orderId}/arrive`, { method: 'POST' });
    if (!res.ok) return;            // do NOT set arrived; let the ticker retry / show error
    setArrived(true);
  } catch {
    // leave as-is; the deadline re-tick will retry
  } finally {
    setPosting(false);
  }
}
```

### [RESOLVED] WR-02: Blob token route returns the raw exception message to the client

**File:** `app/api/blob/upload/route.ts:54-57`
**Issue:** The catch returns `{ error: (e as Error).message }` with status 400. The block comment claims "Generic 400 — no validator/secret leak," but it does the opposite: `handleUpload`/token-broker internals (and any thrown message) are echoed to an untrusted caller. This is an inconsistency with the deliberately generic `bad_request` responses used in every sibling route (`posts`, `arrive`, `start`) and can leak implementation detail (e.g. token/config errors).
**Fix:** Return a static body; log the detail server-side only.
```ts
} catch {
  return Response.json({ error: 'bad_request' }, { status: 400 });
}
```

### [RESOLVED] WR-03: Upload pathname is not per-user scoped despite the documented threat model

**File:** `app/api/blob/upload/route.ts:33-45` (and `app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx:51-59`)
**Issue:** `onBeforeGenerateToken` stores `tgId` in `tokenPayload` but does not constrain the pathname. The client chooses `proof/${crypto.randomUUID()}.webp`, so any authenticated user can mint a token for an arbitrary `proof/*` path. The review brief and RESEARCH (T-3-08/11) state "pathname scoped per-user." `addRandomSuffix` prevents *overwrite* collisions but does not provide per-user isolation, so the stated control is not actually implemented. Impact is low (public bucket, random names, write-only via token), but it diverges from the documented security posture.
**Fix:** Enforce a per-user prefix in `onBeforeGenerateToken` (e.g. validate that `pathname` starts with `proof/${tgId}/`, or return `allowedPathnames`/derive the prefix from the verified session) and have the client upload to `proof/${tgId}/${uuid}.webp`.

### [RESOLVED] WR-04: `o.endured!` non-null assertion can insert NULL into a NOT NULL column

**File:** `app/api/posts/route.ts:99,118` (schema: `db/schema.ts:86,133`)
**Issue:** `orders.endured` is nullable (`boolean('endured')`, null pre-arrival). The route asserts `o.endured!` twice. The invariant "arrivedAt set ⇒ endured set" holds *only because* `arrive/route.ts` writes both together — but `posts/route.ts` gates on `!o.arrivedAt`, not on `endured`. If that invariant is ever broken (a manual DB row, a future code path that sets `arrivedAt` without `endured`, a partial update), `o.endured!` is `null` at runtime: `computeStreak(tgId, null)` takes the truthy-false branch (returns 0, masking the problem) and the insert puts `null` into `posts.endured` (NOT NULL) → unhandled 500. The `!` hides a latent data-integrity assumption.
**Fix:** Treat a null `endured` on an arrived order as a guarded condition rather than asserting it away.
```ts
if (!o.arrivedAt || o.endured == null) return badRequest();
const endured = o.endured; // now boolean, no `!`
const streakDay = await computeStreak(tgId, endured);
// ... endured, not o.endured!
```

### [RESOLVED] WR-05: `arrive`/wait-page deadline boundary makes a same-millisecond arrival count as endured (skip is indistinguishable at the edge)

**File:** `app/api/wait/[id]/arrive/route.ts:58`
**Issue:** `endured = Date.now() >= o.waitDeadline.getTime()`. Because the wait page (`page.tsx`) stamps `waitDeadline = now() + interval` and the client only finalizes via the same `callArrive` for both the skip button and the natural deadline, the *only* thing distinguishing a legitimate completion from a skip is wall-clock time at the moment the POST lands. This is the intended design (server-authoritative), and it is safe against early skips. The edge concern is the other direction: a user who taps "데모: 바로 도착시키기" within the final scheduling jitter of the deadline (or whose POST is delayed by the network until after `waitDeadline`) is recorded as `endured = true` despite skipping. There is no separate signal that the arrival came from the skip path. Low exploitability (the window is the network/round-trip slop at the very end), but the verdict is not robust to "skip late."
**Fix:** If skip-vs-complete must be reliable, have the client send an explicit `intent: 'skip'` and record `endured = intent !== 'skip' && Date.now() >= deadline`, or treat any arrival strictly before `waitDeadline` minus a tolerance as a skip. At minimum document that late skips count as endured by design.

## Info

### IN-01: Duplicated deadline-ensure logic between the SC shell and the start route

**File:** `app/(mini)/wait/[id]/page.tsx:63-75` and `app/api/wait/[id]/start/route.ts:42-65`
**Issue:** The `isNull`-guarded `now() + interval` UPDATE and the `Math.round(WAIT_MS / 1000) * interval '1 second'` SQL are copy-pasted in two places (the SC inlines it to save a round-trip, per RESEARCH Open Q3). Two copies of a security-relevant idempotency guard can drift. The `start` route is described as "the explicit/optional entry point," and the SC never calls it — so the route is currently dead relative to the wait flow.
**Fix:** Extract a single `ensureWaitDeadline(idNum, tgId)` helper in `lib/wait.ts` (or a DAL module) and call it from both, or drop the unused route if nothing invokes it.

### IN-02: `restEmoji` falls back to a hamburger when items is empty, but items is NOT NULL non-empty by construction

**File:** `app/(mini)/wait/[id]/page.tsx:84`
**Issue:** `order.items[0]?.emoji ?? '🍔'` defends against an empty `items[]`, but an order with zero items should be impossible (Phase 2 server-authority builds the snapshot). The fallback silently papers over a would-be data bug rather than failing loudly. Harmless, but the dead defensive branch signals an unclear invariant.
**Fix:** Acceptable as a UI fallback; optionally assert non-empty `items` at order creation so this branch is provably unreachable.

### IN-03: `Rider` reads the DOM by a hard-coded global id, fragile to duplication

**File:** `app/(mini)/wait/[id]/_components/Rider.tsx:22`
**Issue:** `document.getElementById('route')` couples the rider to a globally-unique element id rendered by its sibling in `DeliveryClient`. If the wait card is ever rendered twice (e.g. a future feed preview), the id collides and the rider tracks the wrong path. Works today because there is exactly one instance.
**Fix:** Pass a ref to the `<path>` from `DeliveryClient` instead of a global `getElementById`, or scope the id.

### IN-04: `crypto.randomUUID()` requires a secure context — silent upload failure off-HTTPS

**File:** `app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx:51`
**Issue:** `crypto.randomUUID()` is only defined in secure contexts (HTTPS / localhost). Telegram Mini Apps run over HTTPS so this is fine in production, but a non-tunneled local/dev open (plain http, non-localhost host) throws inside `onPick`, caught by the generic `catch` → "실패 · 다시 시도" with no diagnostic. Minor dev-ergonomics footgun.
**Fix:** No action needed for prod; be aware the generic catch masks this in dev. Optionally guard or log.

### IN-05: `diet`/`caption` placeholders are substituted client-side, so "required" content can be auto-filled

**File:** `app/(mini)/post/[id]/_components/PostClient.tsx:99-100`
**Issue:** The submit sends `diet.trim() || '오늘의 건강 식단'` and `caption.trim() || ph`, so the server's zod `min(1)` on both fields is always satisfied even when the user typed nothing — the "식단 텍스트 + 한마디 입력" requirement (PROOF-03) is effectively optional in practice. Not a bug (intentional UX default), but worth flagging that the server-side `min(1)` does not enforce real user input.
**Fix:** Intentional; if real input is required, drop the client default and let the empty value fail validation (and surface the 400).

---

_Reviewed: 2026-06-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
