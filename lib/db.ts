import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users } from '@/db/schema';

// Runtime queries use the POOLED Neon connection string (DATABASE_URL, host
// contains `-pooler`). The HTTP driver is optimal for single-shot serverless
// queries — Neon handles pooling on its side. drizzle-kit DDL uses DIRECT_URL
// instead (see drizzle.config.ts), never this pooled URL.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql });

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
