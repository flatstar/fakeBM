/**
 * POST /api/admin/delete — operator soft delete (FEED-06 / D-16). Async route
 * handler returning {ok: true} once posts.deletedAt is set.
 *
 * Trust boundary (T-04-17/20, HIGH): the request body is UNTRUSTED and carries
 * ONLY `{ postId }`. No deletedAt/hiddenAt value is ever taken from the body —
 * the server sets the timestamp (mass-assignment is structurally impossible).
 *
 * Gates (in order — mirrors app/api/posts/route.ts ordering):
 *   - T-04-16 (Spoofing): requireSession() first — no session → 401 {error:'auth'}
 *     before any DB work.
 *   - T-04-17 / Pitfall 4 (Elevation of Privilege): isAdmin(tgId) re-check — the
 *     page guard does NOT protect this handler, so EVERY /api/admin/* route
 *     re-verifies the allowlist independently. A valid NON-admin session →
 *     notFoundJson() (404, NOT 403) so the endpoint never confirms it exists to a
 *     non-operator (T-04-18, D-14/15).
 *   - V7: zod parses ONLY { postId: positive int } in try/catch → generic 400.
 *
 * Soft delete (D-16): set deletedAt = now(). The row is PRESERVED but permanently
 * excluded from every public read — lib/feed.ts gates on `deletedAt IS NULL`.
 *
 * No SQL transaction: the runtime db is neon-http (lib/db.ts), which has NO
 * `db.transaction` support. A soft delete is a single-row UPDATE — no transaction
 * is needed for correctness.
 */
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { posts } from '@/db/schema';

// Only postId crosses the boundary — no deletedAt/hiddenAt body field (T-04-20).
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

  // Admin re-check (Pitfall 4): the page guard does NOT protect the API. A valid
  // NON-admin session is treated exactly like a missing endpoint → 404, never 403.
  if (!isAdmin(tgId)) return notFoundJson();

  // Parse the untrusted body — ONLY postId. Any failure is a generic 400 (V7).
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return badRequest();
  }

  // D-16 soft delete: set deletedAt = now(). Row preserved, excluded from all
  // public reads (lib/feed.ts visibility gate). Single-row UPDATE — no tx needed.
  await db
    .update(posts)
    .set({ deletedAt: sql`now()` })
    .where(eq(posts.id, body.postId));

  return Response.json({ ok: true });
}
