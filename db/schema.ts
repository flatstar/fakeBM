import { pgTable, bigint, text, timestamp } from 'drizzle-orm/pg-core';

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
