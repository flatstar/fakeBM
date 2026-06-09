import {
  pgTable,
  bigint,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

/**
 * users — Telegram identity (AUTH-01) + theme persistence (D-06).
 *
 * tgId is the Telegram user id (the PK; no separate signup). theme is the
 * coral|mint preference persisted per user (default coral). There is no
 * password / email — identity comes from verified initData.
 */
export const users = pgTable('users', {
  tgId: bigint('tg_id', { mode: 'number' }).primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  theme: text('theme', { enum: ['coral', 'mint'] }).notNull().default('coral'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * A single ordered item, frozen at order time (D-03 seed-snapshot). Mirrors the
 * relevant lib/catalog MenuItem fields (id/name/emoji/price/kcal) plus qty, so
 * Phase 3 receipts and Phase 5 stats stay immune to later catalog changes.
 */
export type OrderItemSnapshot = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  kcal: number;
  qty: number;
};

/**
 * orders — a virtual ("가짜") order, persisted for the receipt + stats loop
 * (ORDER-05).
 *
 * D-03 seed-snapshot: restName + items[] freeze the catalog at write time.
 * D-04 server-authority: subtotal/tip/total/kcal/savedAmount hold ONLY values
 *   the server recomputed from lib/catalog — the order API never trusts client
 *   money (no money fields in its request body).
 * D-05 server-generated: orderNo is set server-side (never a client RNG / a client
 *   clock) and createdAt defaults to defaultNow() on the DB, copied verbatim from
 *   users.createdAt.
 *
 * The integer PK is sequential/guessable, but every read is owner-scoped on
 * tgId (the users FK), so /order/[id] is IDOR-safe without an opaque id.
 */
export const orders = pgTable(
  'orders',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    // Owner — bigint mode:number to match users.tgId for the FK.
    tgId: bigint('tg_id', { mode: 'number' })
      .notNull()
      .references(() => users.tgId),
    restId: text('rest_id').notNull(),
    restName: text('rest_name').notNull(), // snapshot (immune to catalog edits)
    items: jsonb('items').$type<OrderItemSnapshot[]>().notNull(),
    subtotal: integer('subtotal').notNull(), // 메뉴 합계 (KRW whole-won)
    tip: integer('tip').notNull(), // 배달팁 (KRW)
    total: integer('total').notNull(), // subtotal + tip (KRW)
    kcal: integer('kcal').notNull(), // 총 kcal
    savedAmount: integer('saved_amount').notNull(), // = total ("아끼는 돈", D-04)
    orderNo: text('order_no').notNull(), // 서버 생성 (D-05)
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(), // D-05 server-generated
    // Phase 3 wait/arrival columns — all nullable: empty until the user starts
    // the wait, then the server records authoritative timestamps + judgement.
    waitStartedAt: timestamp('wait_started_at', { withTimezone: true }), // D-03 wait begins
    waitDeadline: timestamp('wait_deadline', { withTimezone: true }), // D-03 server-authority deadline
    arrivedAt: timestamp('arrived_at', { withTimezone: true }), // D-05/09 arrive gate
    endured: boolean('endured'), // D-05 server judgement (null: undecided pre-arrival)
  },
  (t) => [
    // Per-user latest-orders read (Phase 5 stats input) — keyset-friendly.
    index('orders_tg_created_idx').on(t.tgId, t.createdAt),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

/**
 * posts — a public 인증 (proof-of-resisting) post, written once the user has
 * endured (or skipped) the fake wait and uploaded the dual photos (PROOF-01..04).
 *
 * D-10 idempotency: order_id is UNIQUE — one post per order, structurally
 *   enforced at the DB so a double-submit (the 04 API uses onConflictDoNothing
 *   against this target) can never inflate streak/stats.
 * D-15 reSnapshot: restName/items/total/kcal/savedAmount are copied from the
 *   order row at write time so the Phase 4 feed renders without an orders join
 *   and stays immune to later edits.
 * D-16/18 박제: streakDay (server-computed KST streak at write time, lib/streak)
 *   and endured (snapshot of orders.endured) are frozen onto the post.
 */
export const posts = pgTable(
  'posts',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    // D-10 one-per-order — UNIQUE gives the onConflictDoNothing target (plan 04).
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id)
      .unique(),
    tgId: bigint('tg_id', { mode: 'number' })
      .notNull()
      .references(() => users.tgId),
    // reSnapshot (D-15) — feed needs no orders join. Reuse OrderItemSnapshot[].
    restName: text('rest_name').notNull(),
    items: jsonb('items').$type<OrderItemSnapshot[]>().notNull(),
    total: integer('total').notNull(),
    kcal: integer('kcal').notNull(),
    savedAmount: integer('saved_amount').notNull(),
    foodPhotoUrl: text('food_photo_url').notNull(), // D-11 both photos required
    dietPhotoUrl: text('diet_photo_url').notNull(),
    caption: text('caption').notNull(),
    diet: text('diet').notNull(),
    streakDay: integer('streak_day').notNull(), // D-16 frozen (lib/streak)
    endured: boolean('endured').notNull(), // D-18 snapshot of orders.endured
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('posts_created_idx').on(t.createdAt), // Phase 4 feed cursor
    index('posts_tg_created_idx').on(t.tgId, t.createdAt), // Phase 5 per-user
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
