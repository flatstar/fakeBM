// @vitest-environment node
/**
 * AUTH-01 — live idempotent identity upsert (Neon smoke).
 *
 * Calling upsertUser with a tgId inserts a row; calling again with the same
 * tgId updates in place (no duplicate). This exercises the onConflictDoUpdate
 * path from lib/db.ts against the REAL Neon `users` table.
 *
 * DEFERRED OFFLINE: the live Neon DB does not exist yet (plan 01's
 * drizzle-kit push is paused awaiting credentials). describe.skipIf keeps the
 * suite green offline and activates this smoke automatically once DATABASE_URL
 * is present — the upsertUser logic itself already shipped in plan 01.
 */
import { describe, it, expect } from 'vitest';
import { db, upsertUser } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('upsertUser idempotency (AUTH-01, live Neon)', () => {
  // A high, fixed tgId unlikely to collide with real fixtures.
  const tgId = 990000001;

  it('inserts on first sight and updates (not duplicates) on repeat', async () => {
    await upsertUser({ tgId, username: 'first', firstName: 'One' });
    await upsertUser({ tgId, username: 'second', firstName: 'Two' });

    const rows = await db.select().from(users).where(eq(users.tgId, tgId));
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('second');
    expect(rows[0].firstName).toBe('Two');

    // cleanup
    await db.delete(users).where(eq(users.tgId, tgId));
  });
});