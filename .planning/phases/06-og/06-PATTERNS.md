# Phase 6: 공유 카드 & OG 이미지 - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 8 (1 modify schema, 1 new API, 2 new route files, 1 new client island, 2 modify pages, 1 build artifact + optional helper)
**Analogs found:** 6 strong / 8 total (1 net-new with NO repo analog, 1 build artifact)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `db/schema.ts` (MODIFY: + `shares`) | model | CRUD | `posts` / `orders` tables (same file) | exact |
| `app/api/shares/route.ts` (NEW) | controller (route handler) | request-response (create) | `app/api/posts/route.ts` | exact (server-authority POST) |
| `app/share/[id]/page.tsx` (NEW) | route (public SSR page) | request-response | `app/share/page.tsx` (public stub) + `app/(mini)/stats/page.tsx` (card DOM source) | role-match |
| `app/share/[id]/opengraph-image.tsx` (NEW) | route (OG image gen) | transform (snapshot→PNG) | **NONE in repo** — net new | no analog (use RESEARCH Pattern 1) |
| `app/share/[id]/_components/ShareSheet.tsx` (NEW) | component (client island) | event-driven (user actions) | `app/(mini)/post/[id]/_components/PostClient.tsx` | role-match (client island + fetch) |
| `app/(mini)/stats/page.tsx` (MODIFY: + entry button) | route | request-response | self (`isEmpty` already computed L53) | exact |
| `app/(mini)/my/page.tsx` (MODIFY: + entry button) | route | request-response | `app/(mini)/stats/page.tsx` entry | exact |
| `assets/og/*-ogsubset.ttf` (NEW build artifact) | config (asset) | file-I/O | `app/fonts/BM*.ttf` (subset source) | source-match |
| `lib/share.ts` (NEW, optional) | utility | transform | `lib/format.ts` / `lib/stats.ts` pure helpers | role-match |

## Pattern Assignments

### `db/schema.ts` — add `shares` table (model, CRUD)

**Analog:** `posts` table (`db/schema.ts` L111–152) and `orders` (L62–96) — same file.

**Imports** — all required types already imported at top (`db/schema.ts` L1–11): `pgTable, bigint, text, timestamp, integer, jsonb`. No new imports needed (skip `boolean, index, primaryKey` — `shares` needs none).

**FK + bigint owner pattern** (copy from `posts` L120–122):
```ts
tgId: bigint('tg_id', { mode: 'number' })
  .notNull()
  .references(() => users.tgId),
```

**jsonb typed-array column** (copy from `posts.items` L125, retype to `number[]` for `byDay`):
```ts
byDay: jsonb('by_day').$type<number[]>().notNull(),   // length-7 int[]
```

**Nullable columns** (copy the bare-no-`.notNull()` pattern from `orders.arrivedAt` L86 / `posts.hiddenAt` L140) → `topMenu`, `ogUrl`.

**Default-now timestamp** (copy from `posts.createdAt` L135–137):
```ts
createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
```

**Inferred type exports** (copy the exact `posts` L151–152 idiom):
```ts
export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
```

**KEY DIFFERENCE from analogs:** PK is `text('id').primaryKey()` (opaque `crypto.randomUUID()`, D-03) — NOT `integer().generatedAlwaysAsIdentity()` like `orders`/`posts`. The schema comment in `orders` L59–61 explains why those use guessable int PKs (owner-scoped reads); `shares` is publicly readable un-authed, so it needs the opaque id (see Security Domain in RESEARCH). Full column set is in RESEARCH L225–242.

**`[BLOCKING] db:push`:** `npm run db:push` runs `drizzle-kit push` (`package.json` L11). Additive-only (new table) — same clean push as Phase 2/3/4.

---

### `app/api/shares/route.ts` — create snapshot (controller, request-response)

**Analog:** `app/api/posts/route.ts` (full file) — the canonical server-authority POST.

**Auth gate + helpers** (copy the exact shape from `posts/route.ts` L46–48, L62–65):
```ts
import { requireSession } from '@/lib/auth';
// ...
const tgId = await requireSession();
if (!tgId) return Response.json({ error: 'auth' }, { status: 401 });
```

**Server-authority snapshot** — DO NOT trust client values (mirrors the re-snapshot rationale in `posts/route.ts` L36–37, L96–97). Recompute from `lib/stats`:
```ts
import { userTotals, weekRows, bucketWeekByKstWeekday, allItemsRows, topMenuName, currentStreak } from '@/lib/stats';
// lib/stats exports (VERIFIED): userTotals → {savedTotal,kcalTotal,resisted,savedMonth};
//   bucketWeekByKstWeekday(weekRows(tgId), now) → number[7];
//   topMenuName(allItemsRows(tgId)) → string|null; currentStreak(tgId, now) → number.
```
These are the same calls `app/(mini)/stats/page.tsx` L48–51 makes — reuse that exact wiring as the snapshot source.

**Insert + opaque id** (mirror the `db.insert(...).values(...)` shape from `posts/route.ts` L98–116, but use `crypto.randomUUID()` for the PK and NO `onConflictDoNothing` — a share is always new):
```ts
const id = crypto.randomUUID();   // D-03 opaque (Node built-in, zero-dep)
await db.insert(shares).values({ id, tgId, monthLabel, savedMonth, savedTotal, kcalTotal, resisted, streak, byDay, topMenu });
return Response.json({ id });
```

**Empty-stats guard** (Pitfall 6, RESEARCH L372) — `resisted === 0` → 400 `{error:'empty'}` BEFORE insert (the 400/`badRequest` helper pattern is `posts/route.ts` L50–52).

**`monthLabel` timezone (O-2):** derive from `kstMonthBounds(now)` (the KST helper `lib/stats.ts` L79 uses) — NOT raw `now.getMonth()` (RESEARCH Open Question 2).

---

### `app/share/[id]/page.tsx` — public SSR card (route, request-response)

**Analog:** `app/share/page.tsx` (public boundary stub, full file) for the no-auth boundary; `app/(mini)/stats/page.tsx` (L78–132) for the card DOM; `design-reference/screens-social.jsx §ShareCard` (L173–223) for pixel-exact card.

**Public no-auth boundary** — `app/share/page.tsx` L1–7 documents the pattern: rendered with NO session, excluded from the proxy matcher, outside `(mini)`. `proxy.ts` L29 matcher already excludes `share(?:/|$)` — NO proxy change. CRITICAL: do NOT call `requireSession()`/`redirect('/?reauth=1')` here (the `(mini)` guard pattern in `stats/page.tsx` L43–44 must NOT be copied — this route is intentionally public, D-08).

**`params` is a Promise (Next 16, Pitfall 3):**
```ts
export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await getShare(id);   // SELECT shares WHERE id=id (Drizzle eq, parameterized)
  if (!share) notFound();             // import { notFound } from 'next/navigation'
}
```

**`generateMetadata` for og:image** (SHARE-03 crawler preview) — full shape in RESEARCH L197–212. The colocated `opengraph-image.tsx` auto-emits `og:image`; set `openGraph.images: [share.ogUrl ?? \`/share/${id}/opengraph-image\`]` explicitly as belt-and-braces.

**Card DOM from FROZEN snapshot** (D-01 — no live re-aggregation): render the web card reading `share.*` columns. Port the dark-gradient card markup from `design-reference §ShareCard` L186–219 (the inner card div, NOT the overlay/share-target chrome).

**Money HARD RULE (web SSR side):** the ₩/kcal here use `<Won>/<Num>` from `@/components/Money` — same as `stats/page.tsx` L95–106 (`<Won value={savedMonth} ... />`). This is the WEB page; the OG image side uses embedded-font text instead (see below).

---

### `app/share/[id]/opengraph-image.tsx` — OG PNG (route, transform) — NO REPO ANALOG

**Analog:** NONE — this is the project's first `next/og` route. Use **RESEARCH Pattern 1** (L148–189) verbatim as the skeleton. Supporting analogs:
- `app/api/blob/upload/route.ts` L36–41 for the Node-runtime + `@vercel/blob` server-secret rationale (do NOT force Edge).
- `design-reference §ShareCard` L186–219 for the flex card layout to port (it is ALREADY flex — see `display:'flex'` rows at L190, L204, L207).
- `app/fonts.ts` L8–19 for the BM font source paths (`./fonts/BMDohyeon.ttf` etc) — subset these.

**Required exports** (RESEARCH L158–161):
```ts
export const runtime = 'nodejs';                  // D-04 / CLAUDE.md — never Edge
export const alt = '배달의 만족 리포트';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
```

**Font load via fs (Pitfall 5 — always `process.cwd()`):**
```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const display = await readFile(join(process.cwd(), 'assets/og/BMDohyeon-ogsubset.ttf'));
const num = await readFile(join(process.cwd(), 'assets/og/Pretendard-ogsubset.ttf'));
```

**CRITICAL constraints (RESEARCH Pitfalls 1, 2, 4):**
- **flexbox-only** — NO `display: grid`. Port the `stats/page.tsx` tiles (L111–118 uses `gridTemplateColumns`) as `display: flex` instead. The design ShareCard stat row (L204) is already flex.
- **500KB total cap** — subset fonts only (raw BM TTFs are 808KB–1.5MB each; verified `app/fonts/`).
- **₩ glyph rule** — wrap the ₩ amount span in `fontFamily: 'Pretendard'` (the subset that includes ₩); BM fonts mangle ₩→`~` (the same rule `lib/format.ts` L5–10 documents for the web side, applied manually here since `<Won>` can't render inside Satori).

**Blob cache (D-05, optional/on-demand)** — RESEARCH Open Question 3 recommends shipping on-demand + Next caching first; add `@vercel/blob` `head`/`put` (fill `shares.ogUrl`) only if needed. `put`/`head` signatures: `app/api/blob/upload/route.ts` uses `@vercel/blob/client`; for server `put` see `@vercel/blob` `put(pathname, body, opts)`.

---

### `app/share/[id]/_components/ShareSheet.tsx` — share actions (component, event-driven) — client island

**Analog:** `app/(mini)/post/[id]/_components/PostClient.tsx` for the client-island shape (`'use client'`, `useState`, `fetch` POST, error handling); `design-reference §ShareCard` L221–230 for the 4-target button row.

**Client-island header** (copy from `PostClient.tsx` L21–27):
```ts
'use client';
import { useState, type ReactElement } from 'react';
// (useRouter from 'next/navigation' if navigating to /share/[id] after create)
```

**Telegram-native-first share chain** (SHARE-04 / D-11, RESEARCH L339–354, Pitfall 7) — `shareURL` is NOT in `lib/telegram.ts` (that file only boots the SDK). Import directly from the SDK (VERIFIED present: `node_modules/@telegram-apps/sdk/dist/dts/scopes/utilities/links/shareURL.d.ts`):
```ts
import { shareURL } from '@telegram-apps/sdk';
function onShare() {
  if (shareURL.isAvailable()) { shareURL(url, text); return; }      // Telegram chat
  if (navigator.share) { navigator.share({ url, text }); return; }  // Web Share fallback
  navigator.clipboard.writeText(url);                                // last resort
}
```
NOTE: `lib/telegram.ts` L31–41 shows the SDK is imported DYNAMICALLY elsewhere to avoid SSR `window` crashes — but this is a `'use client'` island so a top-level `import { shareURL }` is fine (client-only). Guard every call with `.isAvailable()` (Pitfall 7 — `shareURL` no-ops/throws in a desktop browser).

**Button row** (port `design-reference §ShareCard` L222–229 — 저장/링크/인스타/카톡) but wire each to a REAL action (D-11): 저장 → `<a download>` of the OG PNG; 링크 → `navigator.clipboard`; 인스타/카톡 → the `onShare` chain. The design's `onToast(...)` placeholder becomes the real handler.

**The create→share flow** (D-10): the entry button POSTs `/api/shares` (mirror `PostClient.tsx` L94–105 fetch shape) → gets `{id}` → opens this sheet OR navigates to `/share/[id]`.

---

### `app/(mini)/stats/page.tsx` & `app/(mini)/my/page.tsx` — entry button (route, MODIFY)

**Analog:** self. `stats/page.tsx` L139 has the exact insertion point — the comment `{/* "공유 카드 만들기" TgMainButton OMITTED (D-12 — Phase 6). */}` marks where the button goes (it was deliberately deferred to THIS phase).

**`isEmpty` already computed** — `stats/page.tsx` L53 (`const isEmpty = resisted === 0`). Disable the entry button when `isEmpty` (Pitfall 6, button-disable side of the belt-and-braces guard).

**Entry control** — a client island (the button must POST + navigate, so it can't be the pure SC). Use `TgMainButton` (`components/TgMainButton.tsx`, `'use client'`, props `{label, sub?, icon?, disabled?, onClick}`) as `PostClient.tsx` L311–317 does, OR a small dedicated client button that calls `POST /api/shares`. Pass `disabled={isEmpty}`.

**`/my` entry** — `my/page.tsx` already links to `/stats` (its CTA at L56–73 in the tail). Add the same "공유 카드 만들기" entry; `my` also computes the totals (`my/page.tsx` L50–52) so the empty-guard value is available.

---

### `assets/og/*-ogsubset.ttf` — subset fonts (config, build artifact)

**Source:** `app/fonts/BMDohyeon.ttf` (808KB) / `BMHannaPro.ttf` (1.06MB) — verified present. Pretendard is NOT in `app/fonts/` (CDN-only per CLAUDE.md §6) — download the pinned release once for the subset source (RESEARCH O-1 / A4).

**Build command** (RESEARCH L281–289, `pyftsubset` NOT installed — `pip install fonttools`):
```bash
pyftsubset app/fonts/BMDohyeon.ttf \
  --text='배달의만족리포트이번달,시켜놓고참아서끼덜먹었어요일연속번음최다적든기록＠_·kcal0123456789 ' \
  --output-file=assets/og/BMDohyeon-ogsubset.ttf
pyftsubset 'Pretendard.ttf' --text='0123456789,.₩일번kcal ' \
  --output-file=assets/og/Pretendard-ogsubset.ttf
```
Commit the outputs (deterministic build inputs). The glyph set is the FIXED card text enumerated in RESEARCH L266–278. Verify each subset is well under 500KB (expected 5–30KB, RESEARCH A1).

---

### `lib/share.ts` (optional, utility, transform)

**Analog:** `lib/format.ts` (pure formatters) + `lib/stats.ts` (pure date helpers like `kstMonthBounds` L79). If extracted, hold: the glyph set constant, the `monthLabel` KST builder (O-2), and the `Snapshot` type. Keep it pure (no DB) — mirrors the `lib/stats.ts` "PURE functions" half (L61–189). Optional per RESEARCH L144.

## Shared Patterns

### Server-authority (no client-trusted values)
**Source:** `app/api/posts/route.ts` L36–37, L96–97 (re-snapshot from the order row, body carries no money/streak)
**Apply to:** `app/api/shares/route.ts` — recompute the entire snapshot from `lib/stats`; the POST body carries NO stats values (ideally an empty body).

### Owner-scope from session (no user-supplied id)
**Source:** `lib/auth.ts` `requireSession()` L92–95; usage in `posts/route.ts` L64–65, `stats/page.tsx` L43–44
**Apply to:** `POST /api/shares` (tgId from session only — IDOR/T-05 control). NOT the public `/share/[id]` read (intentionally un-scoped public snapshot, D-08/09).

### Money HARD RULE (₩ never through a BM font)
**Source:** `lib/format.ts` L5–10 + `components/Money.tsx` `<Won>/<Num>`; web usage `stats/page.tsx` L95–106
**Apply to:**
- WEB page (`share/[id]/page.tsx`) → `<Won>/<Num>` (Pretendard tabular-nums), same as stats.
- OG image (`opengraph-image.tsx`) → raw `fmtWon`/`fmtNum` strings inside a `fontFamily:'Pretendard'` span (Satori can't host `<Won>`; ₩ stays out of the BM subset). RESEARCH Pitfall 4.

### Public no-auth boundary
**Source:** `app/share/page.tsx` L1–7 (no session, outside `(mini)`) + `proxy.ts` L29 matcher (`share(?:/|$)` excluded)
**Apply to:** `share/[id]/page.tsx` + `share/[id]/opengraph-image.tsx` — both reachable with no session, NO proxy change.

### Node runtime for fs/Blob (never force Edge)
**Source:** `app/api/blob/upload/route.ts` L20–22 docstring (Node default, Fluid Compute)
**Apply to:** `opengraph-image.tsx` (`export const runtime = 'nodejs'`) — `fs.readFile` for fonts needs Node (D-04 / CLAUDE.md "What NOT to Use").

### Next 16 async `params`
**Source:** RESEARCH Pitfall 3 (Next 16.0.0 changelog) — repo has no prior `[id]` analog reading async params in a metadata/og route, but `PostClient` props show the SC→CC serialization seam.
**Apply to:** `share/[id]/page.tsx` (both `generateMetadata` + default) and `opengraph-image.tsx` — `const { id } = await params;` everywhere.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/share/[id]/opengraph-image.tsx` | route (OG gen) | transform | First `next/og` route in the repo — no `ImageResponse`/Satori precedent. Use RESEARCH Pattern 1 (L148–189) + design ShareCard layout. |
| `assets/og/*-ogsubset.ttf` | config (asset) | file-I/O | No subset-font precedent; `pyftsubset` not installed. Source is `app/fonts/BM*.ttf` (full TTFs). |

## Metadata

**Analog search scope:** `db/`, `app/api/`, `app/share/`, `app/(mini)/{stats,my,post}/`, `lib/`, `components/`, `app/fonts/`, `design-reference/screens-social.jsx`, `proxy.ts`, `node_modules/@telegram-apps/sdk/.../shareURL.d.ts`
**Files scanned:** 13 read in full/targeted + directory listings
**Pattern extraction date:** 2026-06-10
