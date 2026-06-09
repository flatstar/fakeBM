/**
 * GET /api/feed — the load-more keyset page endpoint (FEED-01/02).
 *
 * This handler runs the IDENTICAL query as the `/feed` RSC first page by calling
 * the shared `feedPage` in lib/feed.ts — there is no second, un-gated query, so
 * the visibility gate (hidden/deleted exclusion, T-04-04) can never diverge
 * between the two surfaces.
 *
 * Gates (in order):
 *   - T-04-07 (Spoofing): requireSession() first — an unauthenticated caller
 *     gets 401 {error:'auth'} before any DB work.
 *   - T-04-06 (Tampering): the `?cursor=` query param is opaque base64url. A
 *     present-but-malformed cursor decodes to null → 400 {error:'bad_request'}
 *     (we choose strict rejection over silently restarting at page 1, so a
 *     broken client surfaces rather than re-serving the first page forever).
 *     An ABSENT cursor is the legitimate first-page request (null → page 1).
 *
 * The decoded cursor is only ever used as a Drizzle-parameterized WHERE bound,
 * never string-interpolated — no injection surface.
 */
import { requireSession } from '@/lib/auth';
import { feedPage, decodeCursor } from '@/lib/feed';

function authError() {
  return Response.json({ error: 'auth' }, { status: 401 });
}

function badRequest() {
  return Response.json({ error: 'bad_request' }, { status: 400 });
}

export async function GET(req: Request): Promise<Response> {
  // T-04-07 auth gate first — no DB work for an unauthenticated caller.
  const tgId = await requireSession();
  if (!tgId) return authError();

  // T-04-06: opaque cursor. Absent → first page; present-but-garbage → 400.
  const raw = new URL(req.url).searchParams.get('cursor');
  let cursor = null;
  if (raw !== null) {
    cursor = decodeCursor(raw);
    if (cursor === null) return badRequest(); // present but malformed → reject
  }

  return Response.json(await feedPage(cursor, tgId));
}
