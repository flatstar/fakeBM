/**
 * POST /api/admin/restore — operator restore (FEED-06 / D-16). Async route
 * handler returning {ok: true} once posts.hiddenAt is cleared.
 *
 * Restore semantics (D-16): clear hiddenAt (set null) → the post returns to the
 * public feed. It does NOT touch deletedAt — a soft-deleted post stays deleted
 * (restore un-hides, it does NOT un-delete). The feed visibility gate requires
 * BOTH hiddenAt IS NULL AND deletedAt IS NULL, so clearing only hiddenAt brings
 * back a report-hidden post but leaves an operator-deleted post excluded.
 *
 * Trust boundary + gates: identical to /api/admin/delete — the body carries ONLY
 * `{ postId }` (no hiddenAt/deletedAt value; T-04-20), and the handler re-checks
 * isAdmin independently (Pitfall 4 — the page guard does NOT protect the API). A
 * valid NON-admin session → notFoundJson() (404, never 403; T-04-18).
 *
 * No SQL transaction: neon-http has none (lib/db.ts). A restore is a single-row
 * UPDATE — no transaction needed.
 */
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { posts } from '@/db/schema';

// Only postId crosses the boundary — no hiddenAt/deletedAt body field (T-04-20).
const bodySchema = z.object({ postId: z.number().int().positive() });

function authError() {
  return Response.json({ error: 'auth' }, { status: 401 });
}

function badRequest() {
  return Response.json({ error: 'bad_request' }, { status: 400 });
}

function notFoundJson() {
  return Response.json({ error: 'not_found' }, { status: 404 });
}

export async function POST(req: Request): Promise<Response> {
  // Auth gate first — no DB work for an unauthenticated caller (T-04-16).
  const tgId = await requireSession();
  if (!tgId) return authError();

  // Admin re-check (Pitfall 4): independent of the page guard. Non-admin → 404.
  if (!isAdmin(tgId)) return notFoundJson();

  // Parse the untrusted body — ONLY postId. Any failure → generic 400 (V7).
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return badRequest();
  }

  // D-16 restore: clear hiddenAt only (returns a report-hidden post to the feed).
  // Does NOT touch deletedAt — a soft-deleted post stays deleted. Single-row
  // UPDATE — no transaction needed (neon-http has none).
  await db
    .update(posts)
    .set({ hiddenAt: null })
    .where(eq(posts.id, body.postId));

  return Response.json({ ok: true });
}
