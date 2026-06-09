---
phase: 3
slug: wait-proof
status: secured
threats_open: 0
threats_closed: 18
asvs_level: 1
block_on: high
created: 2026-06-09
---

# SECURITY.md — Phase 03 (wait-proof)

**Audit date:** 2026-06-09
**ASVS Level:** 1
**Block-on severity:** high
**Mode:** register_authored_at_plan_time = true → verify declared mitigations exist in code (no new-threat scan)
**Result:** SECURED — 18/18 threats CLOSED (17 mitigate + 1 mixed accept/mitigate), 0 OPEN

The Phase 3 threat register is sourced from the `<threat_model>` blocks of
`03-01-PLAN.md` … `03-04-PLAN.md`. Each `mitigate` threat was verified by
locating the concrete control in implemented code (file:line). Implementation
files are read-only; this file is the only artifact written.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-3-01 | Tampering (duplicate proof) | mitigate | CLOSED | `db/schema.ts:115-118` — `posts.orderId .references(() => orders.id).unique()` (DB-level idempotency substrate) |
| T-3-02 | Tampering (KST streak forgery) | mitigate | CLOSED | `lib/streak.ts:14` `KST_OFFSET_MS = 9h` fixed; `:20-22` `kstDateKey` (+09:00, no DST); `:34-46` `nextStreak` pure (skip→0, none→1, same-day→hold, +1, else 1). Zero external imports. |
| T-3-03 | Tampering (DDL via pooled URL) | mitigate | CLOSED | `drizzle.config.ts:22` `url: process.env.DIRECT_URL!` — DDL runs over non-pooled DIRECT_URL only; config unchanged (Pitfall 5/6). |
| T-3-04 | Tampering (deadline early / skip abuse) | mitigate | CLOSED | `app/api/wait/[id]/arrive/route.ts:74` `endured = !intentSkip && Date.now() >= o.waitDeadline.getTime()` — server clock re-check; skip forces `endured=false`. |
| T-3-05 | Tampering (client endured/arrived trust) | mitigate | CLOSED | `arrive/route.ts:48-54,74` — body carries only an advisory `intent` bit that can ONLY make the verdict stricter; `endured` is computed server-side, never read from body. |
| T-3-06 | Spoofing/IDOR (others' /wait & arrive) | mitigate | CLOSED | `arrive/route.ts:64,79` + `start/route.ts:49,62` + `wait/[id]/page.tsx:49,69,74` — all reads/writes `and(eq(orders.id, idNum), eq(orders.tgId, tgId))`; no id-only query. |
| T-3-07 | Tampering (re-entry deadline reset) | mitigate | CLOSED | `start/route.ts:44-51` `isNull(orders.waitDeadline)` guard on the UPDATE; mirrored inline in `wait/[id]/page.tsx:63-70`. Re-entry matches zero rows → no clock reset. |
| T-3-08 | Spoofing/Elevation (anon upload token) | mitigate | CLOSED | `app/api/blob/upload/route.ts:33-36` `onBeforeGenerateToken` → `requireSession()`; no session → `throw` before any token mint. |
| T-3-09 | DoS (huge / non-image upload) | mitigate | CLOSED | `blob/upload/route.ts:48` `allowedContentTypes: ['image/jpeg','image/png','image/webp']`; `:52` `maximumSizeInBytes: 8 * 1024 * 1024`. |
| T-3-10 | Info Disclosure (BLOB token leak) | mitigate | CLOSED | `blob/upload/route.ts` uses server-only `@vercel/blob/client` `handleUpload`; grep confirms NO `NEXT_PUBLIC_*BLOB*` and no client-side `BLOB_READ_WRITE_TOKEN` (only an explanatory comment in `PhotoUploadSlot.tsx:8`). |
| T-3-11 | Tampering (guessable pathname) | mitigate | CLOSED | `blob/upload/route.ts:50` `addRandomSuffix: true` + `:43-45` per-user prefix enforcement (`proof/${tgId}/`) — reinforced by WR-03. |
| T-3-12 | Tampering/IDOR (proof on others' order) | mitigate | CLOSED | `app/api/posts/route.ts:88-92` owner-scoped `and(eq(orders.id, body.orderId), eq(orders.tgId, tgId))` → 404; `post/[id]/page.tsx:47-51` SC mirror. |
| T-3-13 | Tampering (proof before arrival) | mitigate | CLOSED | `posts/route.ts:102` `if (!o.arrivedAt || o.endured == null) return badRequest()` — server arrive gate, not a client claim (D-09). |
| T-3-14 | Tampering (duplicate proof inflation) | mitigate | CLOSED | `posts/route.ts:127` `.onConflictDoNothing({ target: posts.orderId })`; `:132` empty insert → 409 `already_posted`. Backed by `posts.orderId UNIQUE` (T-3-01). |
| T-3-15 | Tampering (arbitrary URL injection) | mitigate | CLOSED | `posts/route.ts:34` `BLOB_HOST` regex `^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/`; `:40-41` `z.string().url().regex(BLOB_HOST)` on both photo URLs. |
| T-3-16 | Tampering (client streak/endured/money) | mitigate | CLOSED | `posts/route.ts:38-44` body schema omits money/streak/endured; `:103-106` streak server-computed; `:112-125` reSnapshot restName/items/total/kcal/savedAmount/endured from the ORDER row. |
| T-3-17 | Spoofing (anon photo-upload consumption) | mitigate | CLOSED | `PhotoUploadSlot.tsx:57-64` `upload(..., { handleUploadUrl: '/api/blob/upload' })` consumes the session-gated broker (T-3-08); `post/[id]/page.tsx:40-41` SC requires session before rendering. |
| T-3-SC | Tampering (npm supply-chain) | accept (01/02/04) / mitigate (03) | CLOSED | 01/02/04 add no packages (accepted, no install surface). 03 adds `@vercel/blob@2.4.0` — `package.json:17` `"@vercel/blob": "^2.4.0"`, `npm ls` resolves `@vercel/blob@2.4.0` (Vercel 1st-party); installed via the 03-03 blocking human-verify checkpoint. |

---

## Code-Review Reinforcements (WR-01..05 — all confirmed present)

The 03-REVIEW warnings reinforce several threats and were verified as fixed in code:

- **WR-01** (arrived-only-on-success) — `DeliveryClient.tsx:119` `if (!res.ok) return;` then `:120` `setArrived(true)` only on ok. The client no longer falsely shows "참기 성공!" when the server arrive POST fails. Reinforces T-3-04/05.
- **WR-02** (generic 400, no leak) — `blob/upload/route.ts:68-69` `console.error(...)` + static `{ error: 'bad_request' }`. Raw exception no longer echoed. Reinforces T-3-10.
- **WR-03** (per-user pathname) — `blob/upload/route.ts:43-45` rejects any pathname outside `proof/${tgId}/`; `PhotoUploadSlot.tsx:58` uploads to `proof/${tgId}/${uuid}.webp`. Reinforces T-3-08/11.
- **WR-04** (NULL-endured guard) — `posts/route.ts:102` `|| o.endured == null` plus `:103` `const endured = o.endured` (no non-null assertion). A NULL endured on an arrived order is rejected, never inserted into the NOT NULL column. Reinforces T-3-13/16.
- **WR-05** (explicit skip intent) — `arrive/route.ts:48-54,74` consumes `intent:'skip'`; `DeliveryClient.tsx:388` skip button posts `intent:'skip'`. A late skip at the deadline edge can no longer count as endured. Reinforces T-3-04.

---

## Unregistered Flags

None. No SUMMARY contains a `## Threat Flags` section, and no new attack
surface appeared during implementation without a corresponding threat-register
entry. All API entry points introduced in Phase 3
(`/api/wait/[id]/start`, `/api/wait/[id]/arrive`, `/api/blob/upload`,
`/api/posts`) map to declared threats and were verified above.

---

## Accepted Risks Log

| Threat ID | Scope | Rationale |
|-----------|-------|-----------|
| T-3-SC (plans 01/02/04) | npm supply-chain | These plans install no new packages — no install attack surface introduced. The only Phase 3 dependency addition (`@vercel/blob@2.4.0`, plan 03) is dispositioned `mitigate` and CLOSED above. |

---

## Informational (non-blocking) — carried from 03-REVIEW Info findings

These are correctness/ergonomics notes, not threat-register items, and do not
affect any disposition:

- IN-01: deadline-ensure logic duplicated between `start/route.ts` and `wait/[id]/page.tsx` (both share the identical `isNull` guard — no security drift observed today; refactor candidate).
- IN-05: `diet`/`caption` client-side placeholder substitution means server `min(1)` zod always satisfied (intentional UX default; not a security control).

No action required for Phase 3 sign-off.

---

## Verdict

**SECURED.** Every declared Phase 3 threat resolves to CLOSED with concrete
in-code evidence. `threats_open = 0`. No high-severity gap; phase may ship.
