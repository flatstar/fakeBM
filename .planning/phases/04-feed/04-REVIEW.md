---
phase: 04-feed
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - db/schema.ts
  - lib/feed.ts
  - lib/handle.ts
  - lib/admin.ts
  - app/api/feed/route.ts
  - app/api/posts/[id]/like/route.ts
  - app/api/posts/[id]/report/route.ts
  - app/api/admin/delete/route.ts
  - app/api/admin/restore/route.ts
  - app/(mini)/feed/page.tsx
  - app/(mini)/feed/_components/FeedCard.tsx
  - app/(mini)/feed/_components/FeedList.tsx
  - app/(mini)/feed/_components/LikeButton.tsx
  - app/(mini)/feed/_components/ReportMenu.tsx
  - app/admin/layout.tsx
  - app/admin/page.tsx
  - app/admin/_components/ModActions.tsx
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Phase 4 feed surface: shared keyset query (`lib/feed.ts`), anonymous
handle derivation (`lib/handle.ts`), admin allowlist (`lib/admin.ts`), the five
route handlers (feed / like / report / admin delete / restore), and the feed +
admin UI islands.

The security-critical invariants the phase set out to enforce are, in the main,
correctly implemented:

- **Visibility gate** lives in exactly one WHERE clause in `feedPage`
  (`isNull(hiddenAt) AND isNull(deletedAt)`), and both the RSC page and
  `GET /api/feed` call it — no divergent un-gated query exists.
- **Admin allowlist is re-checked on every `/api/admin/*` handler** (delete,
  restore) independently of the layout/page guards, and non-admins get
  `notFound()`/404 (not 403) on both the page and the API.
- **Self-report block** inverts the owner check correctly and the owner identity
  comes from the DB row, not the body.
- **Anonymity:** `lib/handle.ts` derives only from `tgId`; `feedPage` never joins
  `users`; the admin page uses `handleFor`, never the Telegram username.
- **`ADMIN_TG_IDS`** is read server-side only in `lib/admin.ts`; no
  `NEXT_PUBLIC_` exposure.
- **Mass-assignment** is structurally impossible — no money/owner/visibility key
  is accepted from any request body.
- **Money HARD RULE** is honored: feed card and admin page route ₩/kcal through
  `<Won>`/`<Num>`.

No BLOCKER-class defects were proven. The findings below are correctness and
robustness issues — chiefly that the like "toggle" is mislabeled idempotent and
mis-behaves on a lost-response retry, and a latent stuck-state bug in
`ReportMenu` when `onHide` is absent.

## Warnings

### WR-01: Like "toggle" is not idempotent under a lost-response retry

**File:** `app/api/posts/[id]/like/route.ts:77-89`
**Issue:** The handler implements insert-or-delete-on-conflict: an inserted row ⇒
`liked:true`; a conflict ⇒ DELETE ⇒ `liked:false`. The header comment and the
schema comment (`db/schema.ts:155-160`) repeatedly call this "idempotent," but a
toggle is the opposite of idempotent. Concretely: if a user taps once, the server
inserts the like and returns `{liked:true}`, but the response is lost
(timeout/network blip). `LikeButton.onTap` catches, reverts the optimistic flip,
and shows "다시 눌러주세요." The user taps again → the row now exists → the second
POST DELETEs it → the like the user actually intended is silently removed. The
composite PK guarantees no *duplicate* row, but it does NOT make the operation
idempotent with respect to the caller's intent.
**Fix:** Either (a) document this as a true toggle (drop the "idempotent" claim
and accept that a lost-response retry inverts intent — acceptable per D-09 if
stated honestly), or (b) make the endpoint intent-explicit by accepting the
desired terminal state and upserting/deleting to match, so a retry converges:
```ts
// body: { liked: boolean } — desired terminal state, reconciled idempotently
if (body.liked) {
  await db.insert(likes).values({ postId, tgId })
    .onConflictDoNothing({ target: [likes.postId, likes.tgId] });
} else {
  await db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.tgId, tgId)));
}
// recount → authoritative {liked, count}
```
Option (b) makes a retry a no-op (truly idempotent) and matches the
optimistic-UI reconcile model better.

### WR-02: ReportMenu leaves `submitting` stuck true on success when `onHide` is absent

**File:** `app/(mini)/feed/_components/ReportMenu.tsx:44-62`
**Issue:** On a successful report, `submit` sets `setOpen(false)` and calls
`onHide?.(postId)` but never resets `setSubmitting(false)` on the success path —
it relies on the card unmounting (via `onHide` removing it from the list). `onHide`
is an OPTIONAL prop (`onHide?`). If a future caller mounts `ReportMenu` without an
`onHide` (or `onHide` is a no-op that does not unmount the card), the component
stays mounted with `submitting === true` forever: every reason chip is permanently
`disabled`/dimmed and the scrim's outside-tap close is blocked
(`onClick={() => !submitting && setOpen(false)}` — though the sheet is already
closed). This is a latent correctness trap hidden behind the current single
caller.
**Fix:** Reset the flag on the success path regardless of `onHide`:
```ts
if (!res.ok) throw new Error('report failed');
setOpen(false);
setToast('신고했어요. 검토 후 처리돼요.');
setSubmitting(false);   // <-- always reset; do not depend on unmount
onHide?.(postId);
```

### WR-03: Report endpoint distinguishes hidden-but-not-deleted posts from missing/deleted ones

**File:** `app/api/posts/[id]/report/route.ts:94-126`
**Issue:** The visibility gate for report is `if (!target || target.deletedAt)
return 404`. A post that is HIDDEN (hiddenAt set) but NOT deleted passes this
check and returns `200 {hidden:true}`, whereas a missing or deleted post returns
`404`. Because post ids are sequential `generatedAlwaysAsIdentity` integers, an
authenticated user can probe arbitrary ids and use the `200` vs `404` vs `403`
(self-report) response to enumerate which posts exist and are currently hidden —
information the feed deliberately withholds (hidden posts are excluded from
`feedPage`). The like handler is stricter here (it 404s on `hiddenAt` too,
`like/route.ts:72`), so the two handlers leak different facts for the same id.
**Fix:** Treat hidden like deleted for the report 404 collapse so a non-visible
post is uniformly indistinguishable, mirroring the like handler:
```ts
if (!target || target.hiddenAt || target.deletedAt) return notFoundJson();
```
(Reporting an already-hidden post is a no-op anyway — the first-report hide guard
already short-circuits — so this loses no legitimate behavior while closing the
enumeration channel.)

### WR-04: Admin delete/restore mutate without confirming the post exists or is in a valid state

**File:** `app/api/admin/delete/route.ts:67-72`, `app/api/admin/restore/route.ts:60-65`
**Issue:** Both handlers issue `UPDATE posts SET ... WHERE id = postId` and return
`{ok:true}` unconditionally, regardless of whether any row matched. An operator
acting on a stale moderation list (post already deleted by another operator, or a
postId that never existed) gets a success response and a `router.refresh()` that
silently shows nothing changed. `restore` will also "restore" (clear `hiddenAt`)
a post that was never hidden, and—more notably—`restore` does NOT verify the post
is currently hidden, so a concurrent operator could un-hide a post a moment after
another flagged it. Not a security hole (admin-gated), but the always-`ok:true`
contract hides no-op/lost-update outcomes from the operator.
**Fix:** Use `.returning({ id: posts.id })` and 404 when no row matched, so the
operator UI can surface "이미 처리된 항목이에요":
```ts
const updated = await db.update(posts)
  .set({ deletedAt: sql`now()` })
  .where(eq(posts.id, body.postId))
  .returning({ id: posts.id });
if (updated.length === 0) return notFoundJson();
```

### WR-05: `requireSession()` is called twice per admin page load with no early-out reuse

**File:** `app/admin/page.tsx:53-55` (in concert with `app/admin/layout.tsx:26-31`)
**Issue:** This is defense-in-depth by design and is correct, but note the layout
already guarantees a valid admin session before the page renders; the page then
re-runs `requireSession()` + `isAdmin()`. That is acceptable (and intentional per
the comments), but the duplicate `requireSession()` performs a second cookie read
+ JWT verify per request. More importantly, the redundancy can mask drift: if a
future refactor removes the layout guard, the page guard's `notFound()` is the
only thing standing between a non-admin and the moderation queue — and the
moderation query (`posts.caption`, author `tgId`) would otherwise run. Keep the
page guard, but ensure it is treated as the authoritative boundary, not a
courtesy.
**Fix:** No behavioral change required; this is a robustness note. Optionally
extract a single `requireAdmin()` helper that both the layout and page (and the
`/api/admin/*` handlers) call, so the allowlist semantics live in one place and
cannot drift:
```ts
// lib/admin.ts
export async function requireAdmin(): Promise<number | null> {
  const uid = await requireSession();
  return uid && isAdmin(uid) ? uid : null;
}
```

## Info

### IN-01: `decodeCursor` accepts an arbitrary client-supplied `createdAt`

**File:** `lib/feed.ts:79-92`
**Issue:** `decodeCursor` validates shape but accepts any well-formed
`{c: ISO-date, i: int}`. A client can craft a cursor with an arbitrary
`createdAt`/`id` to seek to any point in the feed. This is harmless (all feed rows
are public and the cursor is only a parameterized WHERE bound — no injection), and
the opacity is explicitly "discourage, not prevent." Recording only so the team
does not later assume the cursor is tamper-proof.
**Fix:** None required. If stronger opacity is ever wanted, HMAC-sign the cursor
payload with `SESSION_SECRET` and reject on signature mismatch.

### IN-02: `relativeTime` recomputes against client `Date.now()` after hydration

**File:** `app/(mini)/feed/_components/FeedCard.tsx:30-44`
**Issue:** `relativeTime` runs at render time using `Date.now()`. The RSC first
page renders it on the server clock; the hydrated client re-renders on the device
clock. A skewed device clock (or the server/client tick boundary) can produce a
brief hydration text mismatch ("방금" vs "1분 전"). Cosmetic only.
**Fix:** None required for v1. If hydration warnings appear, gate the relative
string behind a mounted flag or pass a server-computed label down as a prop.

### IN-03: `handleFor` suffix space is `h >>> 16 % 1000` — only 16 bits feed the suffix

**File:** `lib/handle.ts:60-65`
**Issue:** `adj` uses `h % 7`, `noun` uses `(h >>> 8) % 7`, `suffix` uses
`(h >>> 16) % 1000`. The low 8 bits drive both the adjective and (via overlap with
the noun's byte) are partly reused; the suffix only sees the top 16 bits. The
handle space is intentionally small and collisions are explicitly acceptable
(anonymity, not uniqueness), so this is fine — noting only that the distribution
is not uniform across the nominal `7×7×1000` space.
**Fix:** None required (collisions are by design, D-01).

### IN-04: `itemsSummary` can render an unbounded receipt string with no truncation

**File:** `app/(mini)/feed/_components/FeedCard.tsx:46-49`, used at `120-122`
**Issue:** `itemsSummary` joins every order item; a post with many items produces a
long single-line chip. The container uses `flexWrap: 'wrap'` so it will wrap rather
than overflow, but there is no item-count cap or ellipsis. Purely presentational.
**Fix:** Optional — cap to the first N items with a "외 N개" suffix if long
receipts become common.

---

_Reviewed: 2026-06-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
