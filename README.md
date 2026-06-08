# 배달의 만족 (Baedal-ui-Manjok)

A Telegram Mini App: a "fake delivery" loop where you order food, wait, and prove your
willpower — the joy of *ordering then resisting* (시켜놓고, 참는다), with cumulative
savings/calorie stats and sharing.

This repo is the **Phase 1 walking skeleton**: a real user opens the Mini App with **no
signup**, lands on the public `(boot)` bootstrap surface at the app root `/`, is identified
(Telegram `initData` → server HMAC validate → `users` upsert → signed session cookie), and is
forwarded into the protected coral `/home` shell.

---

## Stack

- **Next.js 16** (App Router, `proxy.ts` not `middleware.ts`) · React 19
- **Telegram Mini App SDK** (`@telegram-apps/sdk-react`, `@telegram-apps/init-data-node`)
- **jose** HS256 session JWT in a `HttpOnly; Secure; SameSite=None; Partitioned` (CHIPS) cookie
- **Drizzle ORM** + **Neon** serverless Postgres
- **Tailwind v4** design tokens (coral theme)
- **Vitest** test suite
- Deploy target: **Vercel**

---

## Local full-stack run

### 1. Environment variables

Copy `.env.local.example` to `.env.local` and fill in real values. **`.env.local` is
git-ignored — never commit it.**

All four variables are **server-only**. None may carry a `NEXT_PUBLIC_` prefix — a
`NEXT_PUBLIC_` prefix would inline the secret into the client bundle and leak it to every
visitor.

| Variable         | Source                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`   | Neon → Connection Details → **Pooled** connection (host contains `-pooler`). Runtime queries use this. |
| `DIRECT_URL`     | Neon → Connection Details → uncheck "Pooled" (direct/non-pooled). Migrations/`db:push` use this. |
| `BOT_TOKEN`      | Telegram **@BotFather** → `/newbot` (or `/token` for an existing bot). |
| `SESSION_SECRET` | Generate locally: `openssl rand -base64 32`.                           |

### 2. Database schema (first run)

Push the Drizzle schema to Neon (uses `DIRECT_URL`, never the pooled string):

```bash
npm run db:push
```

### 3. Run the dev server

```bash
npm run dev
```

The app serves on `http://localhost:3000`. Outside Telegram (in a normal browser),
the `(boot)` surface uses the env-guarded dev-mock identity path (`NODE_ENV==='development'`
only — dead in production) so you can see the `/home` shell without a real Telegram WebView.

---

## Run the tests

```bash
npx vitest run
```

The full offline suite covers AUTH-01..05 (signature/expiry rejection, session round-trip,
the protected/public route boundary), both HIGH security gates (forged-signature reject,
dev-mock prod-null), and the first-open no-redirect-loop guard. The live Neon `users` upsert
smoke runs automatically once `DATABASE_URL` is set (it is skipped offline).

---

## Deploy to a Vercel dev environment

This is a standard Next.js project — no `vercel.json` is required (Vercel auto-detects the
Next.js framework, build command, and output).

### 1. Link the project (first time only)

```bash
vercel link
```

### 2. Set the four **server-only** env vars in the Vercel project

Set these in **Vercel → Project → Settings → Environment Variables** (or via CLI below).
**None may have a `NEXT_PUBLIC_` prefix.**

| Variable         | Value                                              |
| ---------------- | -------------------------------------------------- |
| `BOT_TOKEN`      | Dev BotFather bot token                            |
| `SESSION_SECRET` | `openssl rand -base64 32`                          |
| `DATABASE_URL`   | Neon **pooled** (`-pooler`) connection string      |
| `DIRECT_URL`     | Neon **direct** (non-pooled) connection string     |

```bash
vercel env add BOT_TOKEN
vercel env add SESSION_SECRET
vercel env add DATABASE_URL
vercel env add DIRECT_URL
```

> The same four vars already exist locally in `.env.local`. Once the project is linked you can
> mirror in either direction: `vercel env pull .env.local` pulls the Vercel values down locally.

### 3. Deploy a preview

```bash
vercel
```

Vercel prints a deployment URL. Open it in a normal browser to sanity-check that the root `/`
boots and forwards to the `/home` shell (the dev-mock path renders the shell outside Telegram).

### 4. Register the deployment with a dev BotFather bot

In Telegram **@BotFather → `/myapps`** (or `/newapp`), set the Mini App **Web App URL** to the
Vercel deployment **root `/`**.

> The registered URL is the app **root `/`** — the public `(boot)` bootstrap surface. It
> establishes the session (SDK boot → raw `initData` → `POST /api/session` → `users` upsert →
> `__session` cookie) and then forwards the user to the protected `/home`. Do **not** register
> `/home` directly; `/home` is behind the session guard and would redirect a cookieless first
> open back to the bootstrap.

---

## Real-device verification checklist (AUTH-04 / AUTH-05)

The one behavior that **cannot** be tested offline is whether the
`SameSite=None; Partitioned` (CHIPS) session cookie survives a real Telegram iOS/Android
in-app WebView across close/reopen. This is the AUTH-04 device gate (RESEARCH Open Question 2).
Run this on a **real Telegram device** (iOS and/or Android — the cross-site cookie behavior is
platform-specific):

1. **Open** the Mini App via the dev BotFather bot (the root `/` URL registered above). Confirm
   the brief `(boot)` splash does **not** loop/redirect endlessly and you are forwarded into the
   app.
2. **First open:** confirm the one-time welcome intro shows ("시켜놓고, 참는다" tone), tap
   **"시작하기"** → land on the coral `/home` shell (TG header "배달의 만족", search pill
   "오늘은 뭘 참아볼까? 🤤", willpower hero with ₩ in Pretendard, 5-slot nav + ✋ FAB). Confirm
   the ✋ glyph renders (not 🫷 tofu) and ₩/numbers are not corrupted to `~`.
3. **No signup:** confirm no signup prompt appeared (AUTH-01 identity).
4. **Close & reopen** the Mini App fully, then reopen: confirm the session persists (NO re-auth,
   no welcome intro again, lands straight on `/home`). **This is the AUTH-04
   `SameSite=None; Partitioned` device gate** (resolves Open Question 2).
5. **(AUTH-05)** Open a `share/*` URL in an **external browser** (outside Telegram): confirm it
   opens with **no auth**.
6. **If step 4 FAILS** (session lost on reopen): trigger the documented fallback — per-reopen
   re-auth (D-03), or carry the session token via an `Authorization: tma <raw>` header instead
   of the cookie (RESEARCH Pattern 2 / Pitfall 2). The header-token fallback is already wired.
