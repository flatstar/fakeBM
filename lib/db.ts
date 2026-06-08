import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users } from '@/db/schema';

// Runtime queries use the POOLED Neon connection string (DATABASE_URL, host
// contains `-pooler`). The HTTP driver is optimal for single-shot serverless
// queries — Neon handles pooling on its side. drizzle-kit DDL uses DIRECT_URL
// instead (see drizzle.config.ts), never this pooled URL.
//
// The connection is created LAZILY (on first property access) so that merely
// importing this module — e.g. the AUTH-01 live-DB smoke test, which is
// skipIf(!DATABASE_URL) — does not throw when DATABASE_URL is absent (the live
// Neon DB does not exist until plan 01's drizzle-kit push lands). This keeps
// the offline test suite green while the smoke test stays dormant.
type Db = ReturnType<typeof drizzle>;

let _db: Db | null = null;

function getDb(): Db {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!);
    _db = drizzle({ client: sql });
  }
  return _db;
}

/** Drizzle client (lazy — connects on first query, not on import). */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

/**
 * upsertUser — idempotent Telegram identity write (AUTH-01).
 *
 * Inserts the user on first sight; on a returning tgId, refreshes the mutable
 * profile fields (username / firstName) without touching theme or createdAt.
 * No signup flow — every authenticated request can safely call this.
 */
export async function upsertUser(u: {
  tgId: number;
  username?: string;
  firstName?: string;
}) {
  return db
    .insert(users)
    .values(u)
    .onConflictDoUpdate({
      target: users.tgId,
      set: { username: u.username, firstName: u.firstName },
    });
}
