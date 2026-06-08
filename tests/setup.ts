/**
 * Vitest global setup — shared test environment for the auth slice.
 *
 * `lib/auth.ts` reads `BOT_TOKEN` and `SESSION_SECRET` from the environment at
 * call time (not module load), so setting them here makes the offline suite
 * (AUTH-02/03/04/05, dev-mock guard, first-open bootstrap) run without any live
 * Telegram client or real secrets. BOT_TOKEN is the deterministic FIXTURE token
 * so the HMAC key matches the fixtures in tests/fixtures/initdata.ts.
 *
 * SESSION_SECRET is a throwaway test key — NEVER a real production secret.
 * DATABASE_URL is intentionally NOT set here: the live-DB upsert smoke
 * (tests/db/users-upsert.test.ts) uses describe.skipIf(!DATABASE_URL) so it
 * stays green offline and activates automatically once Neon credentials land.
 */
import { FIXTURE_BOT_TOKEN } from './fixtures/initdata';

// Load .env.local locally (Node built-in; vitest, like drizzle-kit, does not
// auto-load it) so the live-DB upsert smoke (skipIf(!DATABASE_URL)) activates
// once Neon credentials exist. Guarded: absent in CI → the smoke stays skipped.
// Loaded BEFORE the BOT_TOKEN override below so the offline auth suite still
// keys its HMAC off FIXTURE_BOT_TOKEN, not any real BOT_TOKEN in .env.local.
try {
  process.loadEnvFile('.env.local');
} catch {
  // no .env.local (CI) — offline-only env
}

// Hard-override BOTH secrets to deterministic throwaway fixtures, regardless of
// any value loaded from .env.local above. Using `??` for SESSION_SECRET would
// leak a real developer secret into the test JWT path; the offline auth suite
// must key its JWTs off this fixed throwaway so tests are isolated and a real
// production secret never reaches the test code. (.env.local is still loaded so
// DATABASE_URL can activate the live-DB upsert smoke.)
process.env.BOT_TOKEN = FIXTURE_BOT_TOKEN;
process.env.SESSION_SECRET = 'test-session-secret-not-for-prod-0123456789';
