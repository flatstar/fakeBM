---
phase: 02-order-loop
plan: 03
type: execute
wave: 2
depends_on: ["02-01"]
files_modified:
  - db/schema.ts
  - tests/db/orders-schema.test.ts
autonomous: false
requirements: [ORDER-05]
user_setup:
  - service: neon
    why: "orders DDL push + later live INSERT require Neon credentials (Phase 1 established DATABASE_URL/DIRECT_URL; push was previously blocked on these)"
    env_vars:
      - name: DIRECT_URL
        source: "Neon Dashboard → Connection Details → direct (non-pooled) connection string"
      - name: DATABASE_URL
        source: "Neon Dashboard → Connection Details → pooled (-pooler) connection string"
must_haves:
  truths:
    - "orders table exists in db/schema.ts with the D-03 seed-snapshot columns"
    - "orders table is pushed to Neon so live INSERT/SELECT can persist (ORDER-05 prerequisite)"
    - "orders.tgId references users.tgId (owner attribution) and is typed bigint mode:number"
  artifacts:
    - path: "db/schema.ts"
      provides: "orders pgTable + OrderItemSnapshot type + Order/NewOrder type exports"
      contains: "orders"
    - path: "tests/db/orders-schema.test.ts"
      provides: "schema-shape assertions (no live DB)"
  key_links:
    - from: "db/schema.ts orders.tgId"
      to: "users.tgId"
      via: "references() FK"
      pattern: "references"
---

<objective>
Add the `orders` Drizzle table (D-03 seed-snapshot shape) beside `users` in db/schema.ts, lock its shape with a no-DB schema-shape test, and [BLOCKING] push the DDL to Neon so the order API (plan 04) can persist live orders.

Purpose: ORDER-05 persistence substrate. The order record must snapshot the catalog at write time (D-03) so Phase 3 receipts and Phase 5 stats are immune to catalog changes, and all money columns are server-authoritative (D-04).
Output: orders table + OrderItemSnapshot/Order/NewOrder exports, schema-shape test, and the pushed DDL on Neon.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-order-loop/02-CONTEXT.md
@.planning/phases/02-order-loop/02-RESEARCH.md
@.planning/phases/02-order-loop/02-PATTERNS.md
</context>

<phase_goal>
**As a** 미니앱 사용자, **I want to** 확정한 가상 주문이 서버에 영속되기를, **so that** 영수증·통계가 카탈로그 변경과 무관하게 남는다.
</phase_goal>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: orders table in db/schema.ts + schema-shape test (D-03/D-04/D-05)</name>
  <read_first>
    - db/schema.ts (users table — copy import style, bigint('tg_id',{mode:'number'}) typing, defaultNow(), $inferSelect/$inferInsert export pattern, lines 1-21)
    - tests/db/schema.test.ts (schema-shape assertion style: .primary/.name/.notNull/.hasDefault/.enumValues — no live DB)
    - lib/catalog.ts (MenuItem fields id/name/emoji/price/kcal — the snapshot row shape)
    - .planning/phases/02-order-loop/02-RESEARCH.md (Pattern 1 lines 132-170: full orders schema + orderNo/createdAt server-generation)
    - .planning/phases/02-order-loop/02-PATTERNS.md (db/schema.ts add orders section)
  </read_first>
  <files>db/schema.ts, tests/db/orders-schema.test.ts</files>
  <behavior>
    - orders.id is the primary key, generatedAlwaysAsIdentity (integer)
    - orders.tgId maps to column 'tg_id', bigint mode:number, notNull, references users.tgId
    - orders.items is jsonb typed OrderItemSnapshot[] and notNull
    - subtotal/tip/total/kcal/savedAmount are integer notNull columns (KRW whole-won + kcal)
    - restId/restName/orderNo are text notNull; createdAt maps to 'created_at', timestamp withTimezone, notNull, hasDefault (defaultNow)
  </behavior>
  <action>
    First create `tests/db/orders-schema.test.ts` mirroring tests/db/schema.test.ts — import `{ orders }` from `@/db/schema` and assert: `orders.id.primary===true`; `orders.tgId.name==='tg_id'` + `orders.tgId.notNull===true`; `orders.items.name==='items'` + `orders.items.notNull===true`; each of subtotal/tip/total/kcal/savedAmount `.name` (snake_case where applicable: `saved_amount`) and `.notNull===true`; `orders.createdAt.name==='created_at'` + `.hasDefault===true` + `.notNull===true`. Then add the `orders` pgTable to `db/schema.ts` (same file, beside users). Extend the column-helper import to add `integer, jsonb, index`. Export `type OrderItemSnapshot = { id: string; name: string; emoji: string; price: number; kcal: number; qty: number }`. Columns per RESEARCH Pattern 1: `id: integer('id').primaryKey().generatedAlwaysAsIdentity()`; `tgId: bigint('tg_id',{mode:'number'}).notNull().references(() => users.tgId)`; `restId: text('rest_id').notNull()`; `restName: text('rest_name').notNull()`; `items: jsonb('items').$type<OrderItemSnapshot[]>().notNull()`; `subtotal/tip/total/kcal: integer(...).notNull()`; `savedAmount: integer('saved_amount').notNull()`; `orderNo: text('order_no').notNull()` (server-generated, D-05 — NOT Math.random); `createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow()` (copy verbatim from users.createdAt, D-05). Add composite `index('orders_tg_created_idx').on(t.tgId, t.createdAt)` for Phase 5 stats reads. Export `type Order = typeof orders.$inferSelect; type NewOrder = typeof orders.$inferInsert;`. Add a docblock citing D-03 seed-snapshot + D-04 server-authority money + D-05 server-generated orderNo/createdAt.
  </action>
  <verify>
    <automated>npm test -- orders-schema</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- orders-schema` green (all shape assertions above)
    - source assertion: `grep -q "generatedAlwaysAsIdentity" db/schema.ts && grep -q "saved_amount" db/schema.ts && grep -q "orders_tg_created_idx" db/schema.ts`
    - FK present: `grep -q "references(() => users.tgId)" db/schema.ts`
    - no client time/random orderNo helper in schema (D-05): `grep -L "Math.random" db/schema.ts`
    - `npx tsc --noEmit` clean (Order/NewOrder types resolve)
  </acceptance_criteria>
  <done>orders table defined with the full seed-snapshot shape; shape test green; Order/NewOrder exported.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: [BLOCKING] Push orders DDL to Neon (db:push)</name>
  <read_first>
    - drizzle.config.ts (DIRECT_URL DDL config established Phase 1)
    - .planning/phases/01-db/01-CONTEXT.md (Neon credential boundary; 01-01-SUMMARY push-blocked note)
  </read_first>
  <files>db/schema.ts</files>
  <what-built>
    The `orders` table is defined in db/schema.ts (Task 1) and shape-tested offline. It must now be pushed to live Neon via drizzle-kit so plan 04's POST /api/orders can INSERT real rows and /order/[id] can SELECT them. Build + tsc pass WITHOUT this push because Drizzle types come from the schema file, not the live DB — so verification of live order persistence would be a false positive until the table physically exists. drizzle.config.ts already uses DIRECT_URL for DDL (Phase 1, Pitfall 16 — never push over the pooled URL).
  </what-built>
  <action>
    Automation-first, then human verification of the result. (1) Ensure Neon credentials are present: `vercel env pull .env.local` (or confirm DIRECT_URL + DATABASE_URL are set). Phase 1 noted push was previously BLOCKED pending these (01-01-SUMMARY). (2) Run `npm run db:push` (drizzle-kit push over DIRECT_URL DDL). (3) The human confirms the table exists via `psql "$DIRECT_URL" -c '\d orders'` (or the Neon SQL editor): columns id, tg_id, rest_id, rest_name, items (jsonb), subtotal, tip, total, kcal, saved_amount, order_no, created_at and index orders_tg_created_idx. (4) If credentials are unavailable in this environment, report BLOCKED (as in Phase 1) and hand off — plan 04's live-INSERT verification then also defers to this checkpoint; offline tests (schema shape + API recompute/rejection unit tests) still run. This checkpoint is NOT auto-approvable: it gates live order persistence.
  </action>
  <how-to-verify>
    1. Confirm Neon credentials are present locally: `vercel env pull .env.local` (or ensure DIRECT_URL + DATABASE_URL are set). Phase 1 noted push was previously BLOCKED pending these (01-01-SUMMARY).
    2. Run `npm run db:push` (drizzle-kit push, DIRECT_URL DDL).
    3. Confirm the table exists: `psql "$DIRECT_URL" -c '\d orders'` (or Neon SQL editor) shows columns id, tg_id, rest_id, rest_name, items (jsonb), subtotal, tip, total, kcal, saved_amount, order_no, created_at and index orders_tg_created_idx.
    4. If credentials are unavailable in this environment, report BLOCKED (as in Phase 1) and hand off — plan 04's live-INSERT verification then also defers to this checkpoint; offline tests (schema shape + API recompute/rejection unit tests) still run.
  </how-to-verify>
  <verify>
    <automated>npm run db:push</automated>
    <human-check>`psql "$DIRECT_URL" -c '\d orders'` shows all 12 columns + orders_tg_created_idx, or report BLOCKED on missing credentials</human-check>
  </verify>
  <acceptance_criteria>
    - `npm run db:push` completes without error AND `\d orders` confirms the 12 columns + `orders_tg_created_idx`; OR a BLOCKED report is filed citing missing Neon credentials (deferring live persistence to a later resume, per Phase 1 precedent)
    - DDL ran over DIRECT_URL (not pooled): drizzle.config.ts unchanged from Phase 1 DIRECT_URL config
  </acceptance_criteria>
  <done>orders DDL applied to Neon (table + index confirmed), or explicitly reported BLOCKED on missing Neon credentials (offline gates still pass).</done>
  <resume-signal>Type "pushed" once `\d orders` confirms the table + index on Neon, or "blocked: no credentials" to defer live persistence (offline gates still apply).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| schema migration → Neon | DDL must run over the DIRECT (non-pooled) connection; pooled connection for DDL is an availability hazard |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-2-05 | Availability | drizzle-kit push connection | mitigate | drizzle.config.ts uses DIRECT_URL for DDL (Phase 1, Pitfall 16) — push never runs over the pooled URL. |
| T-03-pre (owner column exists) | Information Disclosure | orders.tgId | mitigate | tgId column + users FK make ownership checkable; plan 04 enforces the read-time IDOR guard (eq(orders.tgId, sessionTgId)). |
| T-02-pre (money columns are server-set) | Tampering | subtotal/total/savedAmount columns | mitigate | columns exist to hold SERVER-recomputed values only; plan 04's API never accepts client money (D-06). |
| T-{phase}-SC | Tampering | npm installs | mitigate | zero new dependencies (drizzle-orm/drizzle-kit already installed Phase 1); no install task. |
</threat_model>

<verification>
- `npm test -- orders-schema` green offline
- `npx tsc --noEmit` clean
- [BLOCKING] `npm run db:push` applies the DDL; `\d orders` confirms columns + index (or BLOCKED report if no credentials)
</verification>

<success_criteria>
- orders table defined with D-03/D-04/D-05 shape; Order/NewOrder/OrderItemSnapshot exported
- DDL pushed to Neon (or explicitly BLOCKED on credentials, deferring live persistence per Phase 1 precedent)
</success_criteria>

<output>
Create `.planning/phases/02-order-loop/02-03-SUMMARY.md` when done (note push status: pushed | blocked-on-credentials).
</output>
