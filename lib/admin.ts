/**
 * lib/admin.ts — server-only operator allowlist (FEED-06 / D-14).
 *
 * isAdmin parses ADMIN_TG_IDS (a comma-separated list of Telegram user ids) AT
 * CALL TIME, not module load — the lib/auth.ts convention — so tests can stub
 * the env per-case and so a redeploy-free env change takes effect immediately.
 *
 * SECURITY (D-14): ADMIN_TG_IDS MUST be a server-only env var. It must NEVER be
 * prefixed NEXT_PUBLIC_ — that would ship the operator allowlist to the client
 * and expose who the admins are. Every /api/admin/* handler must re-check
 * isAdmin (defense in depth); the page guard alone does not protect the API.
 */

/**
 * isAdmin — true when tgId is in the ADMIN_TG_IDS allowlist.
 *
 * Empty / unset env → all false. Whitespace around each id is trimmed;
 * non-integer entries are ignored.
 */
export function isAdmin(tgId: number): boolean {
  const raw = process.env.ADMIN_TG_IDS ?? '';
  const allow = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(Number.isInteger);
  return allow.includes(tgId);
}
