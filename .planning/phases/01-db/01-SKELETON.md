# Walking Skeleton — 배달의 만족 (Telegram Mini App)

**Phase:** 1
**Generated:** 2026-06-08

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

A user opening the Telegram mini app is identified with **no signup** (initData → server HMAC validate → `users` upsert → session cookie), and lands on the coral home shell behind an authenticated route boundary — with the session persisting across reopen on a real device.

This single path crosses every architectural seam the rest of the project builds on: client Telegram SDK boot → raw initData → server validation (forged/expired rejected) → one real Neon/Drizzle write (`users` upsert) → jose session cookie → `(mini)` protected boundary vs public `share` → one real UI interaction (welcome intro → home shell) → deployed and device-verified.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 16.2.7 App Router + React 19.2.7** | Prototype is React; Vercel first-class; SSR/OG (Phase 6) friendly. Next 16 renames `middleware.ts` → **`proxy.ts`** (Node runtime default) — used for the coarse auth redirect |
| Styling | **Tailwind CSS v4.3.0** (`@theme` + `@theme inline`) | Maps the prototype's CSS-variable design tokens 1:1; `@theme inline` is load-bearing for the `next/font` var chain |
| Data layer | **Neon Postgres + Drizzle 0.45.2** (`neon-http` driver) | Serverless connection-exhaustion-safe; pooled `DATABASE_URL` for runtime, **direct `DIRECT_URL`** for migrations/`drizzle-kit push` |
| Auth | **Telegram `initData` HMAC** (`@telegram-apps/init-data-node` `validate`) → **jose JWT session cookie** | No signup; bot token server-only; cookie `HttpOnly; Secure; SameSite=None; Partitioned` (CHIPS) for the cross-site Telegram iframe; re-auth on reopen (D-01/02/03) |
| Route protection | **`(mini)` layout `requireSession()` guard (authoritative) + `proxy.ts` (coarse)** | Defense-in-depth: Server Actions bypass proxy, so the layout/handler guard is authoritative; `share/*` is matched-out and public (AUTH-05) |
| Dev auth bypass | **Env-guarded `devMockUser()` in `lib/auth.ts`** | `NODE_ENV==='development'` only; returns null in production (D-11/12) — the single security-critical hand-rolled branch, unit-tested to be dead in prod |
| Fonts | **BM 한나/도현/주아 self-hosted via `next/font/local`; Pretendard via subset CDN** | BM display fonts free-for-commercial; **all ₩/numbers/kcal/stats route through Pretendard `tabular-nums`** (BM ₩ glyph renders as a narrow `~`) |
| Theme | **CSS-variable swap on root `data-theme` (coral default ↔ mint), persisted on `users.theme`** | Mechanism + both palettes only this phase; toggle UI exposed in Phase 5 (D-04/05/06). No localStorage for theme |
| Deployment target | **Vercel (dev/preview)** + dev BotFather bot | Real-device SameSite=None cookie verification (MEDIUM-confidence project Blocker) requires a deployed URL registered with a bot |
| Test runner | **Vitest + @testing-library/react + jsdom** | Fast, Next 16/ESM-friendly; offline initData fixtures (signed/forged/expired) avoid a live Telegram client |
| Directory layout | `app/` (route groups `(mini)` protected / `share` public, `api/session`), `lib/` (auth, db, telegram, catalog, format), `db/` (schema), `components/` (ported primitives), `app/fonts/`, `proxy.ts` at root | Mirrors project ARCHITECTURE.md; `(mini)` vs `share` boundary established here, followed by every later phase |

## Stack Touched in Phase 1

- [x] Project scaffold (Next 16, Tailwind v4, ESLint, Vitest) — plan 01
- [x] Routing — `(mini)` protected group + `share` public group + `proxy.ts` boundary — plan 02
- [x] Database — real Neon read AND write: `users` upsert (AUTH-01) + schema pushed via `drizzle-kit push` — plans 01/02
- [x] UI — interactive element wired to the API: client SDK boot → `POST /api/session` → cookie; welcome intro → home shell — plans 02/03
- [x] Deployment — Vercel dev environment + documented local full-stack run; real-device session verification — plan 04

## Out of Scope (Deferred to Later Slices)

> Anything that is *not* in the skeleton — explicit, to prevent future phases from re-litigating Phase 1's minimalism.

- Restaurant/menu/cart/order interaction (the home is a **placeholder shell** — real catalog browsing is Phase 2; `lib/catalog.ts` + `FoodTile` are ported now but unused interactively)
- Fake delivery wait, proof authoring, dual photo upload (Phase 3)
- Social feed, likes, moderation (Phase 4)
- Stats aggregation, MY screen, **theme toggle UI exposure** (Phase 5 — mechanism only here)
- Share cards, `next/og` Korean OG images, public SSR `/share/[id]` content (Phase 6 — `share/*` is a public stub here)
- Removed design Tweaks: 5-color picker, title-font picker, wait-time slider, iPhone frame (D-04 — not ported)
- Refresh-token flow (D-03: re-auth on reopen instead); zod v4 (locked to v3 for Phase 1)
- Telegram bot push / tunnel-based device automation (v2 / NOTIF-01)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions (route boundary, auth, DB driver, design tokens, font roles):

- **Phase 2** — Fake order loop: home/store/menu browse + filter + cart + server-authoritative virtual order (₩0). Consumes `lib/catalog.ts`, the `(mini)` guard, and the design primitives.
- **Phase 3** — Wait → proof (core loop): delivery wait staging + dual photo upload (Vercel Blob) + fake receipt + proof post saved to DB. Extends `users` with domain tables.
- **Phase 4** — Hall of fame feed: public feed + cursor pagination + idempotent likes + report/hide/moderation.
- **Phase 5** — Stats & MY: real-time savings/kcal/streak aggregation + weekly chart + conversions + MY records + **theme toggle UI** (mechanism shipped here).
- **Phase 6** — Share cards & OG: public SSR `/share/[id]` + `next/og` Korean subset card (different auth boundary — the `share/*` public stub from Phase 1).
