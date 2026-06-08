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

process.env.BOT_TOKEN = FIXTURE_BOT_TOKEN;
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'test-session-secret-not-for-prod-0123456789';
