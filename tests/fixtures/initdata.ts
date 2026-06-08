import { sign } from '@telegram-apps/init-data-node';

/**
 * Offline initData fixtures — no live Telegram client required.
 *
 * These exercise the three auth paths from plan 02's validate()-based tests:
 *   - validInitData    → correctly HMAC-signed with a current auth_date (AUTH-01/04 happy path)
 *   - forgedInitData   → valid string with a tampered `hash` → signature verification fails (AUTH-02)
 *   - expiredInitData  → correctly signed but auth_date far in the past → fails an `expiresIn` window (AUTH-03)
 *
 * FIXTURE_BOT_TOKEN is a throwaway deterministic test token. It is NOT a real
 * BotFather token and must never be used in production — it exists only so the
 * fixtures and their verifying tests share the same HMAC key.
 */
export const FIXTURE_BOT_TOKEN =
  '1234567890:TEST_FIXTURE_BOT_TOKEN_do_not_use_in_prod';

const FIXTURE_USER = {
  id: 99281932,
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  language_code: 'ko',
  is_premium: false,
  allows_write_to_pm: true,
};

const nowSec = Math.floor(Date.now() / 1000);
const nowDate = new Date(nowSec * 1000);

// Far in the past so any reasonable expiresIn window rejects it, but the
// signature itself is valid (isolates the auth_date check from the HMAC check).
const expiredDate = new Date((nowSec - 7 * 24 * 60 * 60) * 1000);

// auth_date is supplied via the third `authDate` argument to sign() (the
// SignData payload type omits it); sign() injects it into the signed string.

/** Correctly HMAC-signed initData with a current auth_date. */
export const validInitData: string = sign(
  { user: FIXTURE_USER },
  FIXTURE_BOT_TOKEN,
  nowDate,
);

/** validInitData with a single tampered hash character → signature fails. */
export const forgedInitData: string = (() => {
  const params = new URLSearchParams(validInitData);
  const hash = params.get('hash') ?? '';
  // Flip the final hex char so the HMAC no longer matches.
  const tampered = hash.slice(0, -1) + (hash.slice(-1) === '0' ? '1' : '0');
  params.set('hash', tampered);
  return params.toString();
})();

/** Correctly signed but auth_date is a week old → fails any short expiresIn window. */
export const expiredInitData: string = sign(
  { user: FIXTURE_USER },
  FIXTURE_BOT_TOKEN,
  expiredDate,
);
