# Phase 6: 공유 카드 & OG 이미지 - Research

**Researched:** 2026-06-10
**Domain:** Server-rendered OG image generation (next/og + Satori), Korean subset fonts, public no-auth SSR routes, Telegram/Web share actions
**Confidence:** HIGH (next/og API + SDK share API + Blob API all verified against installed packages / current official docs)

## Summary

This is the project's most technically novel phase, but every moving part is now verified against an authoritative source. OG generation uses **Next 16's built-in `next/og` `ImageResponse`** via the file convention `app/share/[id]/opengraph-image.tsx` — confirmed on the live Next.js **16.2.9** docs (matching the pinned `next@16.2.7`). The route reads **subset Korean TTFs** with `node:fs/promises` `readFile` and passes them to `ImageResponse({ fonts: [{ name, data, weight, style }] })`. The single hardest constraint is verified and load-bearing: **`ImageResponse` has a 500KB total bundle cap (JSX + CSS + fonts + images)** and the rendering engine (Satori) **supports flexbox only — `display: grid` and most non-flex layout will not render**. Both facts make the subset-font requirement (D-07) non-negotiable, not an optimization — the raw BM TTFs are 808KB–1.5MB each and would blow the cap on their own (this resolves the STATE.md "[Phase 6] OG 한글 subset 500KB 내" flag: **yes, achievable, but only with subsetting**).

The data model is a straightforward additive Drizzle table (`shares`) following the exact same `[BLOCKING] db:push` pattern that Phase 2/3/4 already executed cleanly over `DIRECT_URL`. The public id is `crypto.randomUUID()` (zero-dep, verified working in Node). The public route boundary already exists: `proxy.ts`'s matcher excludes `share(?:/|$)`, so both `/share/[id]/page.tsx` and its colocated `opengraph-image.tsx` are reachable with no session — no proxy change needed. Share actions map cleanly to the **installed** `@telegram-apps/sdk` `shareURL(url, text?)` (verified present, `.isAvailable()`-wrapped) for the Telegram-native target, with `navigator.share` / `navigator.clipboard` / an `<a download>` for the Web fallbacks.

**Primary recommendation:** Build four artifacts — (1) `shares` Drizzle table + `[BLOCKING] db:push`; (2) `POST /api/shares` (requireSession, server-authority snapshot from `lib/stats`, returns `randomUUID`); (3) `app/share/[id]/page.tsx` public SSR + `generateMetadata` for `openGraph.images` **+** colocated `opengraph-image.tsx` (Node runtime, subset fonts, flex-only layout, Blob cache); (4) a `_components/ShareSheet` client island wiring `shareURL` / Web Share / clipboard / download onto the existing /stats /my "공유 카드 만들기" entry. Subset the fonts as a committed build artifact under `assets/og/` before writing the OG route.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Snapshot creation (freeze stats) | API / Backend (`POST /api/shares`) | DB (`shares` insert) | Server-authority — recompute from `lib/stats`, never trust client values (mirrors `POST /api/posts`) |
| Opaque public id | API / Backend | — | `crypto.randomUUID()` server-side; client never picks the id |
| OG PNG render | Frontend Server (RSC route, Node runtime) | CDN/Storage (Blob cache) | `opengraph-image.tsx` is a special cached Route Handler; fonts need Node `fs` |
| Public card page | Frontend Server (SSR, no auth) | — | `/share/[id]/page.tsx` outside `(mini)` guard; crawler + human readable |
| `og:image` meta emission | Frontend Server (`generateMetadata`) | — | Crawler preview (SHARE-03) needs static-ish meta tags in `<head>` |
| Telegram-native share | Browser / Client | — | `shareURL` touches `window.Telegram`; client-only island |
| Web share / clipboard / download | Browser / Client | — | `navigator.share` / `navigator.clipboard` / `<a download>` are browser APIs |

## Standard Stack

All core dependencies for this phase are **already installed** — this phase adds **zero npm runtime packages**. The only new tool is a Python font subsetter used at build time (not shipped).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next/og` (`ImageResponse`) | built into `next@16.2.7` | OG PNG generation from JSX | [CITED: nextjs.org/docs .../image-response] — built-in since Next 14 moved it from `next/server`; **do NOT install `@vercel/og`** (CLAUDE.md "What NOT to Use") |
| `@vercel/blob` | `^2.4.0` (installed) | Cache generated OG PNG by share id | [VERIFIED: installed `dist/index.d.ts`] `put(pathname, body, opts)`, `head(pathname)` for check-then-generate |
| `drizzle-orm` | `0.45.2` (installed) | `shares` table + insert/select | [VERIFIED: package.json] same patterns as `orders`/`posts` |
| `crypto.randomUUID` | Node built-in | Opaque public share id (D-03) | [VERIFIED: `node -e` returned a v4 UUID] zero-dep, unguessable — no `nanoid`/`uuid` install |
| `@telegram-apps/sdk` | `3.11.8` (via installed `sdk-react@3.3.9`) | `shareURL` Telegram-native share | [VERIFIED: installed `dist/dts/.../shareURL.d.ts`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `3.24.4` (installed) | (Optional) validate `POST /api/shares` body | Body is near-empty (server recomputes everything) — minimal/no body, so zod is optional here |
| `lib/stats.ts` functions | existing | Snapshot source (`userTotals`, `weekRows`+`bucketWeekByKstWeekday`, `topMenuName`, `currentStreak`) | Called at share-creation to freeze the snapshot |
| `lib/format.ts` `fmtWon`/`fmtNum` | existing | OG text strings (₩, kcal) | Used as raw strings inside the OG JSX (no `<Won>` component in Satori — see Pitfall 4) |

### Build-time tooling (NOT shipped)
| Tool | Purpose | Notes |
|------|---------|-------|
| `fonttools` / `pyftsubset` | Subset BM + Pretendard TTFs to the fixed card glyph set (D-07) | **NOT installed** (`fonttools NOT installed` confirmed). Install via `pip install fonttools` (best-effort) or `brew install fonttools`. Produces committed `assets/og/*.ttf`. |
| `glyphhanger` | Alternative subsetter (npm, wraps pyftsubset) | Heavier (needs Python + a headless browser for crawling). **Recommend `pyftsubset` directly** — the glyph set is a *known fixed list*, so no crawling is needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `opengraph-image.tsx` file convention | A plain `app/share/[id]/og/route.tsx` Route Handler returning `ImageResponse` | File convention auto-wires `<meta og:image>` and is cached by default; a manual route needs manual `generateMetadata` URL wiring. **Use the convention.** |
| `crypto.randomUUID()` | short base62 (D-03 discretion) | UUID is zero-dep and collision-safe; base62 is shorter/prettier but needs a hand-rolled generator. **UUID unless a shorter link is a hard product requirement.** |
| On-demand OG + Blob cache (D-05) | Pre-generate at `POST /api/shares` | On-demand is simpler (let the convention render lazily) and Next already caches the route; Blob cache is the *second* layer for cross-deploy persistence. **On-demand + optional Blob cache.** |
| `glyphhanger` | `pyftsubset` directly | Fixed glyph set ⇒ no crawl needed ⇒ `pyftsubset --text=` is simpler. |

**Installation:** No npm installs. Build-time subsetter only:
```bash
pip install fonttools        # provides pyftsubset (best-effort; or: brew install fonttools)
```

**Version verification (live, 2026-06-10):**
- `next@16.2.7` installed; next/og docs reflect **16.2.9** (same minor line) — [VERIFIED: nextjs.org live docs `version: 16.2.9`].
- `@vercel/blob@2.4.0` installed — `put`/`head` signatures read from installed `dist/index.d.ts`.
- `@telegram-apps/sdk` `shareURL` present in installed `dist/dts/scopes/utilities/links/shareURL.d.ts`.

## Package Legitimacy Audit

> This phase installs **no npm runtime packages**. The only build-time tool is `fonttools` (PyPI), used to produce committed font artifacts — not a shipped dependency.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `fonttools` | PyPI | ~13 yrs (since 2013) | very high (millions/mo) | github.com/fonttools/fonttools | not run (offline) | Approved — well-known, build-time only |

slopcheck was not run (no installs this phase). `fonttools` is a long-established, widely-used font-manipulation library; `pyftsubset` is its canonical subsetting CLI. No runtime package decisions to gate. **No new npm dependency means no slopcheck/registry gate is required for the shipped bundle.**

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────────────────────────┐
   /stats or /my page    │  "공유 카드 만들기" button (client island)      │
   (authed, (mini))      │  → POST /api/shares                           │
                         └───────────────┬──────────────────────────────┘
                                         │ (cookie session)
                          ┌──────────────▼───────────────┐
                          │  POST /api/shares             │  requireSession() → tgId
                          │  (Node, server-authority)     │
                          │  1. recompute snapshot from   │──► lib/stats (userTotals,
                          │     lib/stats (NEVER client)  │     weekRows+bucket, topMenuName,
                          │  2. id = crypto.randomUUID()  │     currentStreak)
                          │  3. INSERT shares row         │──► Neon (shares table)
                          │  4. return { id }             │
                          └──────────────┬────────────────┘
                                         │ { id }
                          ┌──────────────▼───────────────┐
        client navigates  │  ShareSheet overlay OR        │
        or opens sheet    │  redirect to /share/[id]      │
                          └──────────────┬────────────────┘
                                         │
   ════════════════ PUBLIC BOUNDARY (no session — proxy matcher excludes share) ═══════
                                         │
   crawler / browser ───────────────────┤
        GET /share/[id]                  │
                          ┌──────────────▼───────────────────────────────┐
                          │  app/share/[id]/page.tsx  (SSR, no auth)      │
                          │  - SELECT shares WHERE id=[id] → notFound()   │──► Neon
                          │  - render web card from snapshot              │
                          │  - generateMetadata → openGraph.images:[ogUrl]│
                          └──────────────┬────────────────────────────────┘
                                         │ <head> emits og:image = /share/[id]/opengraph-image
                          ┌──────────────▼───────────────────────────────┐
                          │  app/share/[id]/opengraph-image.tsx           │
                          │  export const runtime = 'nodejs'              │
                          │  export const size = {width:1200,height:630}  │
                          │  1. SELECT shares (snapshot)                  │──► Neon
                          │  2. (optional) head(blob path) → cached? 302  │──► Vercel Blob
                          │  3. readFile(assets/og/*subset.ttf)           │──► fs
                          │  4. new ImageResponse(<flex JSX>, {fonts})    │
                          │  5. (optional) put(png) to Blob, set ogUrl    │──► Vercel Blob
                          │  → image/png 200                              │
                          └───────────────────────────────────────────────┘
```

### Recommended Project Structure
```
app/
├── api/shares/route.ts              # POST — create snapshot, return {id} (requireSession)
└── share/
    └── [id]/
        ├── page.tsx                 # public SSR card page + generateMetadata (no auth)
        ├── opengraph-image.tsx      # next/og PNG (runtime='nodejs', subset fonts)
        └── _components/
            └── ShareSheet.tsx       # client island: shareURL / Web Share / clipboard / download
assets/og/
├── BMDohyeon-ogsubset.ttf           # committed subset (display headline glyphs)
└── Pretendard-ogsubset.ttf          # committed subset (digits, ₩, kcal)
db/schema.ts                         # + shares table  ([BLOCKING] db:push)
lib/share.ts                         # (optional) pure helpers: glyph set, month label, snapshot type
```
> `app/share/page.tsx` (the existing stub) stays as the bare `/share` index; the new card lives at `/share/[id]`. The proxy matcher `share(?:/|$)` already excludes both.

### Pattern 1: `opengraph-image.tsx` with subset Korean fonts (Node runtime)
**What:** The Next file-convention OG generator. Reads subset TTF bytes with `node:fs/promises` and embeds them.
**When to use:** This is the canonical SHARE-02 implementation.
```tsx
// Source: nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image (v16.2.9, VERIFIED)
//         + nextjs.org/docs/app/api-reference/functions/image-response (fonts shape, VERIFIED)
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';                 // D-04: never force Edge (CLAUDE.md)
export const alt = '배달의 만족 리포트';
export const size = { width: 1200, height: 630 };  // standard OG
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;                   // Next 16: params is a Promise (VERIFIED v16.0.0 changelog)
  // ... SELECT shares WHERE id = id  (owner not needed — public snapshot) ...

  // process.cwd() is the project root (VERIFIED in docs).
  const display = await readFile(join(process.cwd(), 'assets/og/BMDohyeon-ogsubset.ttf'));
  const num = await readFile(join(process.cwd(), 'assets/og/Pretendard-ogsubset.ttf'));

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
                    background: 'linear-gradient(160deg,#2a1d14,#3d2a1c 60%,#52331f)',
                    color: '#fff', padding: 64, fontFamily: 'BMDisplay' }}>
        {/* flex-only layout — NO grid (Satori unsupported) */}
        {/* ₩ amount uses fontFamily:'Pretendard' (Money HARD RULE analog, Pitfall 4) */}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'BMDisplay', data: display, weight: 800, style: 'normal' },
        { name: 'Pretendard', data: num, weight: 700, style: 'normal' },
      ],
    },
  );
}
```

### Pattern 2: Public SSR page + `generateMetadata` (crawler preview, SHARE-03)
```tsx
// Source: nextjs.org generateMetadata + opengraph-image conventions (VERIFIED)
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const share = await getShare(id);          // SELECT shares WHERE id
  if (!share) return {};                       // page() will notFound()
  // The colocated opengraph-image.tsx auto-populates og:image; setting it
  // explicitly is belt-and-braces and lets you point at the Blob-cached URL.
  return {
    title: '배달의 만족 · 참아서 만든 기록',
    openGraph: {
      title: '배달의 만족 리포트',
      images: [share.ogUrl ?? `/share/${id}/opengraph-image`],
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) notFound();
  // render the web card from the FROZEN snapshot (no live re-aggregation, D-01)
}
```

### Pattern 3: `shares` Drizzle table (opaque text PK, additive `db:push`)
```ts
// Mirrors orders/posts conventions in db/schema.ts (VERIFIED from current schema).
export const shares = pgTable('shares', {
  id: text('id').primaryKey(),                                  // D-03 crypto.randomUUID()
  tgId: bigint('tg_id', { mode: 'number' }).notNull().references(() => users.tgId),
  // Frozen snapshot (D-01/02) — copied from lib/stats at creation, never re-aggregated.
  monthLabel: text('month_label').notNull(),                   // "2026.06"
  savedMonth: integer('saved_month').notNull(),
  savedTotal: integer('saved_total').notNull(),
  kcalTotal: integer('kcal_total').notNull(),
  resisted: integer('resisted').notNull(),
  streak: integer('streak').notNull(),
  byDay: jsonb('by_day').$type<number[]>().notNull(),          // length-7 int[]
  topMenu: text('top_menu'),                                   // nullable (topMenuName → null)
  ogUrl: text('og_url'),                                       // nullable Blob cache URL (D-05)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
```
> `[BLOCKING] db:push`: `npm run db:push` (`drizzle-kit push`) runs over `DIRECT_URL`. This is **additive only** (new table, no column drops) — identical to the Phase 2/3/4 pushes that all ran clean (STATE.md confirms the credential blocker is resolved). The OG route and page will 500/`notFound` until the table exists, so the push gates everything downstream.

### Anti-Patterns to Avoid
- **`display: grid` / unsupported CSS in OG JSX:** Satori is flexbox-only — grid silently fails to lay out. Port the design's grid/tile rows as `display: flex` (the design ShareCard is already mostly flex). [CITED: nextjs.org image-response "Advanced layouts (e.g. `display: grid`) will not work"]
- **Embedding full BM TTF in OG:** 808KB–1.5MB each blows the **500KB total** ImageResponse cap. Subset first (D-07). [CITED: nextjs.org image-response "Maximum bundle size of 500KB ... includes ... fonts"]
- **Forcing `runtime = 'edge'` for OG:** D-04 / CLAUDE.md forbid it — `fs.readFile` for fonts wants Node; Fluid Compute makes Node default and sufficient.
- **Trusting client-supplied stats in `POST /api/shares`:** Recompute from `lib/stats` server-side (server-authority, exactly like `POST /api/posts` re-snapshots from the order row). The body should carry no money/kcal fields.
- **Using `<Won>`/`<Num>` React components inside `ImageResponse`:** Satori renders a constrained subset; use the raw `fmtWon`/`fmtNum` strings in a `fontFamily:'Pretendard'` span instead (the ₩-glyph HARD RULE still applies — see Pitfall 4).
- **Exposing real name/handle on the card:** D-09 — wordmark only, no `firstName`/handle (privacy; the snapshot is self-contained so no users join is needed).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PNG rasterization of the card | A canvas/puppeteer screenshot service | `next/og` `ImageResponse` | Built-in, cached, no extra infra; puppeteer can't run on serverless cheaply |
| Opaque public id | Custom RNG / counter+hash | `crypto.randomUUID()` | Node built-in, cryptographically unguessable, zero-dep (D-03) |
| Telegram share deep-link | Hand-built `t.me/share/url?...` string | SDK `shareURL(url, text?)` | [VERIFIED: installed SDK] handles the `/share/url` quirk + `.isAvailable()` gating (the raw `t.me/share` form is misparsed as a @username — known bug) |
| Font subsetting | Manual glyf-table editing | `pyftsubset --text=...` | fonttools handles cmap/glyf/hmtx/composite glyphs correctly |
| OG meta tags | Hand-written `<meta property="og:image">` | `generateMetadata` + `opengraph-image.tsx` convention | Next auto-emits `og:image`/`:width`/`:height`/`:type` |
| Snapshot freeze | Re-query live posts on every `/share` open | Frozen `shares` columns (D-01) | Deterministic + Blob-cacheable OG; immune to later hide/delete |

**Key insight:** Almost nothing here should be custom — the phase is a composition of built-in Next/Node/SDK primitives. The only artifact you *produce* (not install) is the subset font, and even that is one `pyftsubset` invocation.

## Korean Glyph Set for Subsetting (D-07)

The card uses a **fixed, enumerable** glyph set, so subsetting is deterministic (no crawler needed). Enumerate from `design-reference/screens-social.jsx §ShareCard` (L173–223) + the locked copy. Two subsets:

**Display subset (BMDohyeon or BMHannaPro — headline/labels):** the Korean of —
`배달의 만족` · `리포트` · `이번 달, 시켜놓고 참아서` · `아끼고` · `kcal 덜 먹었어요` · `일 연속` · `번 참음` · `최다 적` · `참아서 만든 기록` · `＠배달의_만족`

Unique Korean syllables to include (deduplicated):
`배 달 의 만 족 리 포 트 이 번 달 시 켜 놓 고 참 아 서 끼 kcal(라틴) 덜 먹 었 어 요 일 연 속 번 참 음 최 다 적 든 기 록`
→ roughly **~35–45 unique Hangul syllables** + Latin `kcal` + the `＠`/`_`/`·`/`,` punctuation. Pass them as `--text=` (literal string is simplest and least error-prone).

**Number subset (Pretendard — amounts, the ₩ HARD RULE):**
digits `0123456789`, grouping `,`, the **`₩`** symbol (U+20A9), `kcal` Latin, `.` (for `2026.06`), and the `일`/`번` units if rendered in Pretendard. Recommend a dedicated Pretendard subset of `0-9 , . ₩ 일 번 kcal` so tabular digits + ₩ render correctly (BM fonts mangle ₩ → narrow `~`, Pitfall 4).

**Subset command (build-time, produces committed artifacts):**
```bash
pyftsubset app/fonts/BMDohyeon.ttf \
  --text='배달의만족리포트이번달,시켜놓고참아서끼덜먹었어요일연속번음최다적든기록＠_·kcal0123456789 ' \
  --output-file=assets/og/BMDohyeon-ogsubset.ttf --flavor=  # keep .ttf (Satori prefers ttf/otf)

pyftsubset 'path/to/Pretendard.ttf' \
  --text='0123456789,.₩일번kcal ' \
  --output-file=assets/og/Pretendard-ogsubset.ttf
```
> Verify each subset is well under the 500KB **combined** cap (a fixed-glyph BM subset is typically **5–30KB**, resolving the STATE.md flag decisively). Commit the `.ttf` outputs (they are deterministic build inputs, not generated-at-runtime). Note: Pretendard's full TTF is not in `app/fonts/` (only BM fonts are self-hosted; Pretendard is CDN per CLAUDE.md §6) — the subset source must be downloaded once from the pinned Pretendard release for the build step, OR render *all* OG text (including digits) in a BM subset and accept BM digit styling **except** keep ₩ out of BM (open question O-1).

## Common Pitfalls

### Pitfall 1: 500KB ImageResponse cap (the STATE.md flag)
**What goes wrong:** Embedding a full BM TTF (808KB–1.5MB) exceeds the hard 500KB ImageResponse bundle limit → build/runtime failure.
**Why it happens:** The cap counts JSX + CSS + **fonts** + images together.
**How to avoid:** Subset to the fixed glyph set (D-07). A fixed-text BM subset is ~5–30KB. [CITED: nextjs.org image-response]
**Warning signs:** OG route errors mentioning bundle size; blank/failed image.

### Pitfall 2: Satori is flexbox-only
**What goes wrong:** The design's tile row / chart laid out with `grid` renders empty or collapsed.
**Why it happens:** Satori supports only flexbox + a CSS subset; `display: grid` is explicitly unsupported.
**How to avoid:** Use `display: flex` everywhere in the OG JSX. The design ShareCard already uses flex for the stat row and the weekly bars — port that, not the /stats page's `gridTemplateColumns` tiles. [CITED: nextjs.org image-response]
**Warning signs:** Elements missing/overlapping in the rendered PNG.

### Pitfall 3: `params` is a Promise in Next 16
**What goes wrong:** `params.id` is `undefined` because the code reads it synchronously.
**Why it happens:** Next **16.0.0** made `opengraph-image`/page `params` a Promise (verified in the docs version history).
**How to avoid:** `const { id } = await params;` in both `page.tsx` (`generateMetadata` + default) and `opengraph-image.tsx`.
**Warning signs:** A "params should be awaited" runtime warning; missing snapshot.

### Pitfall 4: ₩ glyph through a BM font (the project Money HARD RULE)
**What goes wrong:** Rendering `₩12,000` in a BM display font corrupts ₩ into a narrow `~` (documented in `lib/format.ts` / `components/Money.tsx`).
**Why it happens:** BM fonts lack/misdraw the ₩ (U+20A9) glyph.
**How to avoid:** In the OG JSX, wrap the ₩ amount in a span with `fontFamily: 'Pretendard'` (the subset that includes ₩ + tabular digits). The React `<Won>`/`<Num>` components can't be used inside Satori, so apply the rule manually via `fontFamily`. Include ₩ in the Pretendard subset, NOT the BM subset.
**Warning signs:** ₩ shows as `~` or a tofu box in the PNG.

### Pitfall 5: Cold-start / fs path in serverless
**What goes wrong:** `readFile('app/fonts/...')` fails on Vercel because the path is wrong, or the font isn't traced into the function bundle.
**Why it happens:** `process.cwd()` is the project root; relative paths and untraced assets break.
**How to avoid:** Always `join(process.cwd(), 'assets/og/...')` (verified pattern). Committing under `assets/og/` (a real on-disk path referenced by the route) gets it traced. Verify on a real Vercel deploy (human-verify).
**Warning signs:** ENOENT in the OG route logs on Vercel but works locally.

### Pitfall 6: Empty-stats share (0 인증)
**What goes wrong:** A user with 0 인증 creates a card showing ₩0 / empty bars — or `POST /api/shares` produces a degenerate snapshot.
**Why it happens:** `lib/stats` returns coalesced 0s (it never throws), so a share *can* be created empty.
**How to avoid (D discretion, recommended):** Disable the "공유 카드 만들기" button when `resisted === 0` (the /stats page already computes `isEmpty`), or guard `POST /api/shares` to 400 on an empty snapshot with a "먼저 인증하세요" message. Pick one — recommend the button-disable + server guard (belt-and-braces).
**Warning signs:** A shared link showing all zeros.

### Pitfall 7: `shareURL` availability outside Telegram
**What goes wrong:** Calling `shareURL` on the public web page (opened in a normal browser, not Telegram) throws / no-ops.
**Why it happens:** `shareURL` is Telegram-context-only; the installed SDK wraps it with `.isAvailable()`.
**How to avoid:** In the ShareSheet, branch: if `shareURL.isAvailable()` use it; else fall back to `navigator.share` (Web Share API), else `navigator.clipboard.writeText`. The download action (`<a download>` of the OG PNG) is always available.
**Warning signs:** Share button dead on the public `/share/[id]` page in a desktop browser.

## Code Examples

### Share actions island (SHARE-04)
```tsx
// 'use client'
// Telegram-native first, Web Share / clipboard / download fallbacks (D-11).
// shareURL is .isAvailable()-wrapped (VERIFIED: installed @telegram-apps/sdk).
import { shareURL } from '@telegram-apps/sdk';

const url = `${origin}/share/${id}`;
const text = '나 이번 달 이만큼 참았어 👀 #배달의만족';

function onShare() {
  if (shareURL.isAvailable()) { shareURL(url, text); return; }      // Telegram chat picker
  if (navigator.share) { navigator.share({ url, text }); return; }  // Web Share (인스타/카톡 etc)
  navigator.clipboard.writeText(url);                                // last-resort copy
}
function onCopyLink() { navigator.clipboard.writeText(url); }
// 저장: an <a href={ogUrl ?? `/share/${id}/opengraph-image`} download> downloads the PNG.
```

### `POST /api/shares` server-authority snapshot (SHARE-01)
```ts
// Source: mirrors app/api/posts/route.ts (VERIFIED existing pattern) — requireSession,
// server recomputes from lib/stats, body carries NO stats values.
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { shares } from '@/db/schema';
import { userTotals, weekRows, bucketWeekByKstWeekday, allItemsRows, topMenuName, currentStreak } from '@/lib/stats';

export async function POST(): Promise<Response> {
  const tgId = await requireSession();
  if (!tgId) return Response.json({ error: 'auth' }, { status: 401 });

  const now = new Date();
  const { savedTotal, kcalTotal, resisted, savedMonth } = await userTotals(tgId, now);
  if (resisted === 0) return Response.json({ error: 'empty' }, { status: 400 }); // Pitfall 6
  const byDay = bucketWeekByKstWeekday(await weekRows(tgId), now);
  const topMenu = topMenuName(await allItemsRows(tgId));
  const streak = await currentStreak(tgId, now);
  const monthLabel = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`; // see O-2 (KST)

  const id = crypto.randomUUID(); // D-03 opaque
  await db.insert(shares).values({
    id, tgId, monthLabel, savedMonth, savedTotal, kcalTotal, resisted, streak, byDay, topMenu,
  });
  return Response.json({ id });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { ImageResponse } from 'next/server'` | `from 'next/og'` | Next 14.0.0 | Use `next/og` (CLAUDE.md already locks this) |
| `@vercel/og` package install | Built into `next/og` | Next 13.3+ | No install (CLAUDE.md "What NOT to Use") |
| Sync `params` in metadata/og routes | `params: Promise<...>` | Next 16.0.0 | `await params` everywhere (Pitfall 3) |
| `middleware.ts` | `proxy.ts` (Node default) | Next 16 | Already migrated in this repo (`proxy.ts` present) |

**Deprecated/outdated:**
- `@vercel/og` as a separate dependency — superseded by `next/og`.
- Raw `t.me/share?url=` deep links — misparsed; use SDK `shareURL` (or the `/share/url` form).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A fixed-glyph BM subset lands at ~5–30KB (well under 500KB) | Korean Glyph Set / Pitfall 1 | LOW — even a generous estimate is far under cap; verify after first `pyftsubset` run |
| A2 | Committing fonts under `assets/og/` gets them file-traced into the Vercel function | Pitfall 5 | MEDIUM — if untraced, ENOENT on deploy; mitigate by verifying on a real deploy (human-verify) |
| A3 | `navigator.share` covers 인스타/카톡 sharing on the public page | Share actions | LOW — Web Share opens the OS share sheet; exact app targets are OS-dependent (acceptable fallback) |
| A4 | Pretendard subset source is obtainable for the build (not currently in `app/fonts/`) | Korean Glyph Set | MEDIUM — drives O-1 (₩ rendering); fallback is BM-only digits with ₩ handled separately |

## Open Questions (RESOLVED)

1. **₩ + digit font in OG (O-1).**
   - What we know: BM fonts mangle ₩; Pretendard renders it. Pretendard's full TTF is CDN-loaded in the app (not in `app/fonts/`).
   - What's unclear: whether to (a) download+subset Pretendard for the OG digits/₩, or (b) render all OG text in a BM subset and special-case only the ₩ span.
   - Recommendation: subset a tiny Pretendard `0-9 , . ₩ kcal` set for the amount line; everything else in the BM subset. Resolve at plan time (one extra committed subset).
   - **RESOLVED:** Plan 06-01 subsets a dedicated tiny Pretendard `0-9 , . ₩ kcal` set + BM subset; OG amount line uses the Pretendard span.

2. **Month label timezone (O-2).**
   - What we know: `lib/stats` is strictly KST (+09:00). `now.getMonth()` in `POST /api/shares` uses server-local time.
   - What's unclear: a server near a month boundary could label the wrong month vs the KST aggregation.
   - Recommendation: derive `monthLabel` from `kstMonthBounds(now)` / the same KST helper `lib/stats` uses, not raw `getMonth()`. Cheap to fix; flag for the planner.
   - **RESOLVED:** Plan 06-02 derives `monthLabel` from `kstMonthBounds(now)` (lib/stats KST helper), not raw getMonth().

3. **Blob cache necessity (D-05).**
   - What we know: `opengraph-image.tsx` is cached by Next by default; `@vercel/blob` `put` defaults to a 1-month `cacheControlMaxAge`.
   - What's unclear: whether the Blob layer adds enough value over Next's own caching to justify the extra `head`/`put` round-trips.
   - Recommendation: ship **on-demand + Next caching first**; add Blob cache (fill `shares.ogUrl`) only if cross-deploy persistence or crawler-stability proves necessary. Keep the `ogUrl` column now (cheap, nullable) so the cache can be added without a migration.
   - **RESOLVED:** Plan 06-03 ships on-demand OG + Next caching; keeps nullable `shares.ogUrl` column for a later Blob cache without migration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `next/og` (`ImageResponse`) | SHARE-02 OG render | ✓ (in next 16.2.7) | 16.2.7 | — |
| `@vercel/blob` `put`/`head` | OG cache (D-05) | ✓ (installed) | 2.4.0 | Skip cache; rely on Next caching |
| `crypto.randomUUID` | opaque id (D-03) | ✓ | Node built-in | — |
| `@telegram-apps/sdk` `shareURL` | Telegram share (D-11) | ✓ (installed) | 3.11.8 | `navigator.share` / clipboard |
| Neon (`DATABASE_URL`/`DIRECT_URL`) | `shares` table + db:push | ✓ (provisioned in `.env.local`) | — | — |
| `pyftsubset` (fonttools) | Font subset (D-07) | ✗ (not installed) | — | `pip install fonttools` or `brew install fonttools`; or glyphhanger |
| Pretendard full TTF (for subset source) | ₩/digit subset (O-1) | ✗ (CDN-only in app) | — | Download pinned release once, OR BM-only digits |

**Missing dependencies with no fallback:** none (all blockers have a path).
**Missing dependencies with fallback:**
- `pyftsubset` — install via pip/brew at build time (not shipped).
- Pretendard subset source — download the pinned release once for the build step, or fall back to BM-only digit rendering (O-1).

## Validation Architecture

> `workflow.nyquist_validation` not disabled → section included. Framework verified from `vitest.config.ts` + `package.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (`@vitejs/plugin-react`) |
| Config file | `vitest.config.ts` (jsdom default; server tests use `// @vitest-environment node`) |
| Quick run command | `npx vitest run tests/api/shares.test.ts` |
| Full suite command | `npm test` (`vitest run`) |
| Setup | `tests/setup.ts`; `@` → project root alias |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHARE-01 | `POST /api/shares` requires session (401 unauth) | unit (mock auth) | `npx vitest run tests/api/shares.test.ts -t auth` | ❌ Wave 0 |
| SHARE-01 | Snapshot is server-recomputed from `lib/stats`, body carries no stats values | unit (mock db+stats) | `npx vitest run tests/api/shares.test.ts -t snapshot` | ❌ Wave 0 |
| SHARE-01 | Empty-stats (resisted 0) → 400, no row | unit | `npx vitest run tests/api/shares.test.ts -t empty` | ❌ Wave 0 |
| SHARE-01 | `shares` table shape (cols/types) + `id` is text PK | unit (schema introspection) / live | `npx vitest run tests/db/shares-schema.test.ts` | ❌ Wave 0 |
| SHARE-01 | `id` is `crypto.randomUUID()` (opaque, unguessable, not sequential) | unit | `npx vitest run tests/api/shares.test.ts -t opaque-id` | ❌ Wave 0 |
| SHARE-02 | OG route returns `image/png` 200 | unit (invoke default export, assert ImageResponse `content-type`) | `npx vitest run tests/api/og-image.test.ts` | ❌ Wave 0 |
| SHARE-02 | Subset fonts exist + are < cap (assert file size of `assets/og/*.ttf`) | unit | `npx vitest run tests/api/og-image.test.ts -t fontsize` | ❌ Wave 0 |
| SHARE-02 | 한글 깨짐 없음 (visual correctness) | **manual-only** | human-verify (render the PNG, inspect Korean + ₩) | — |
| SHARE-03 | Public `/share/[id]` reachable with NO session (no redirect) | unit (proxy/page, no cookie → 200, not `/?reauth=1`) | `npx vitest run tests/auth/public-open.test.ts -t share-id` | ⚠ extend existing |
| SHARE-03 | `generateMetadata` emits `openGraph.images` (og:image) for a valid id | unit | `npx vitest run tests/api/share-page.test.ts -t metadata` | ❌ Wave 0 |
| SHARE-03 | Unknown id → `notFound()` (404, no leak) | unit | `npx vitest run tests/api/share-page.test.ts -t notfound` | ❌ Wave 0 |
| SHARE-04 | ShareSheet picks shareURL → Web Share → clipboard by availability | unit (RTL, mock SDK/navigator) | `npx vitest run tests/ui/share-sheet.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/shares.test.ts` (or the file touched)
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green before `/gsd-verify-work` + the manual 한글/₩ visual check + a real-Vercel-deploy crawler preview check (SHARE-03 og:image renders externally).

### Wave 0 Gaps
- [ ] `tests/api/shares.test.ts` — covers SHARE-01 (auth, snapshot server-authority, empty guard, opaque id)
- [ ] `tests/db/shares-schema.test.ts` (or a live skipIf block) — covers SHARE-01 table shape
- [ ] `tests/api/og-image.test.ts` — covers SHARE-02 (png/200, font-size guard)
- [ ] `tests/api/share-page.test.ts` — covers SHARE-03 (metadata og:image, notFound)
- [ ] Extend `tests/auth/public-open.test.ts` — `/share/[id]` no-session reachability
- [ ] `tests/ui/share-sheet.test.tsx` — covers SHARE-04 fallback chain
- [ ] Build artifact: `assets/og/*-ogsubset.ttf` committed (created via `pyftsubset`) — a *task*, not a test, but blocks SHARE-02
- [ ] `[BLOCKING] db:push` of `shares` — gates all DB-touching tests (live)

## Security Domain

> `security_enforcement` not set to false → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireSession()` on `POST /api/shares` (create); read path is intentionally public (SHARE-03) |
| V3 Session Management | yes | Existing jose `__session` cookie; share *read* needs none |
| V4 Access Control | yes | Snapshot created only for the session `tgId`; `/share/[id]` is public-by-design (no per-user data beyond the frozen snapshot, no name/handle — D-09) |
| V5 Input Validation | yes | `[id]` route param used only as a DB lookup key (parameterized via Drizzle `eq`); near-empty body — optional zod |
| V6 Cryptography | yes | `crypto.randomUUID()` for the unguessable public id (never hand-roll) |

### Known Threat Patterns for {Next 16 RSC + Neon + public share}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sequential-id enumeration of public shares | Information Disclosure | Opaque `randomUUID` id (D-03) — not a sequential integer |
| Client-forged stats in the snapshot | Tampering | Server recomputes from `lib/stats`; body carries no stats values (mirrors `POST /api/posts`) |
| Creating a share for another user | Elevation / IDOR | `tgId` from `requireSession()` only — never a body/param field |
| PII leak via the public card | Information Disclosure | No name/handle on card or page; wordmark only (D-09) |
| Unbounded share creation (spam) | DoS | Empty-stats guard (Pitfall 6); rate-limiting deferred (v1 trust — note for v2) |
| Untrusted host in a shared/og URL | Tampering | OG PNG is server-generated; the share URL is same-origin `/share/[id]` (no client-supplied host) |

## Sources

### Primary (HIGH confidence)
- nextjs.org `/docs/app/api-reference/file-conventions/metadata/opengraph-image` (live, `version: 16.2.9`) — file convention, `size`/`alt`/`contentType` exports, `fs.readFile` font loading, `params` Promise, Node-runtime local-asset pattern.
- nextjs.org `/docs/app/api-reference/functions/image-response` (live, `version: 16.2.9`) — `ImageResponse` options, `fonts` shape `{name,data,weight,style}`, **500KB cap**, flexbox-only / no-grid, ttf/otf/woff only.
- Installed `node_modules/@telegram-apps/sdk/dist/dts/scopes/utilities/links/shareURL.d.ts` — `shareURL(url, text?)` `.isAvailable()`-wrapped; `shareMessage`/`shareStory` also present.
- Installed `node_modules/@vercel/blob/dist/index.d.ts` — `put(pathname, body, opts)` (`cacheControlMaxAge`, `addRandomSuffix`, `allowOverwrite`), `head(pathname)`.
- Repo files (VERIFIED): `proxy.ts` (matcher excludes `share(?:/|$)`), `lib/stats.ts`, `db/schema.ts`, `app/api/posts/route.ts`, `app/api/blob/upload/route.ts`, `lib/format.ts`, `components/Money.tsx`, `app/fonts.ts`, `vitest.config.ts`, `design-reference/screens-social.jsx §ShareCard`.
- `node -e` — `crypto.randomUUID()` returns a v4 UUID.

### Secondary (MEDIUM confidence)
- WebSearch — Telegram `t.me/share/url` quirk (raw `t.me/share` misparsed as @username) corroborating why SDK `shareURL` is preferred.

### Tertiary (LOW confidence)
- General `pyftsubset` glyph-count → file-size estimate (~5–30KB) — to be confirmed empirically on first subset run (A1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed; APIs read from installed `.d.ts` + live Next 16.2.9 docs.
- Architecture: HIGH — public boundary already exists in `proxy.ts`; patterns mirror existing `posts`/`orders` routes.
- Pitfalls: HIGH — 500KB cap and flexbox-only are quoted from current official docs; ₩ rule is an existing repo invariant.
- Font subset sizing (A1) / Pretendard source (O-1): MEDIUM — needs one build-step confirmation.

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable stack; Next 16 minor moves slowly within a line)
