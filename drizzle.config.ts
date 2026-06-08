import { defineConfig } from 'drizzle-kit';

// drizzle-kit is a standalone CLI and does NOT load .env.local (only Next.js
// does). Use Node's built-in env-file loader (Node 20.12+/21.7+) so a local
// `npx drizzle-kit push` sees DIRECT_URL. Guarded: on Vercel/CI the file is
// absent and the envs are already injected, so the throw is swallowed.
try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local not present (CI/Vercel) — env vars already in process.env
}

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
