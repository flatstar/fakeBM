import { defineConfig } from 'drizzle-kit';

// Migrations / push run DDL over the DIRECT (non-pooled) Neon connection.
// Pitfall 5: never run schema changes through the pooled DATABASE_URL — the
// pooler can break DDL/transaction semantics. Runtime queries use the pooled
// URL (see lib/db.ts); migrations use DIRECT_URL only.
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
});
