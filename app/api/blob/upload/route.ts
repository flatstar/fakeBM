/**
 * POST /api/blob/upload — the Vercel Blob client-upload token broker (PROOF-02).
 *
 * The dual photos (시킨 척한 음식 / 실제 내 식단, D-11) are uploaded DIRECTLY from
 * the client to Vercel Blob via `@vercel/blob/client` `upload()`, bypassing the
 * 4.5MB serverless body limit. The client never holds BLOB_READ_WRITE_TOKEN
 * (server-only secret, T-3-10) — instead it calls THIS route, which mints a
 * short-lived, scoped upload token via `handleUpload`.
 *
 * Trust boundary: the caller is UNTRUSTED. `onBeforeGenerateToken` is the gate:
 *   - T-3-08 (Spoofing/Elevation): requireSession() — no session → throw, so an
 *     anonymous caller can never obtain an upload token.
 *   - T-3-09 (DoS): allowedContentTypes restricts to image/* and
 *     maximumSizeInBytes caps each upload at 8MB.
 *   - T-3-11 (Tampering): addRandomSuffix prevents guessable-pathname overwrite.
 *
 * Pitfall 2 (RESEARCH): `onUploadCompleted` is a deliberate no-op. On localhost
 * Vercel cannot reach the callback, so the uploaded URL is NEVER persisted here;
 * the client carries `result.url` into POST /api/posts (04) which writes the row.
 *
 * Node.js runtime (do NOT force Edge): the Blob client SDK + future fs work want
 * Node; Fluid Compute makes it the default and sufficient.
 */
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireSession } from '@/lib/auth';

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // Session gate (T-3-08) — block anonymous upload-token issuance.
        const tgId = await requireSession();
        if (!tgId) throw new Error('Not authenticated');
        // T-3-08/11: per-user pathname scoping. The minted token is constrained
        // to THIS user's prefix, so an authenticated caller can never write into
        // another user's namespace (WR-03). The client uploads to
        // `proof/${tgId}/${uuid}.webp`; any pathname outside that prefix is
        // rejected before a token is issued. addRandomSuffix still prevents
        // overwrite collisions within the prefix.
        if (!pathname.startsWith(`proof/${tgId}/`)) {
          throw new Error('pathname out of scope');
        }
        return {
          // T-3-09: only the three image MIME types the dual-photo flow accepts.
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          // T-3-11: random suffix → unguessable pathname, no overwrite.
          addRandomSuffix: true,
          // T-3-09: hard per-file ceiling (8MB) even after client downscale.
          maximumSizeInBytes: 8 * 1024 * 1024,
          tokenPayload: JSON.stringify({ tgId }),
        };
      },
      // Pitfall 2: no-op on purpose — localhost never receives this callback, and
      // the URL is persisted by POST /api/posts (04), not here.
      onUploadCompleted: async () => {
        /* intentionally empty */
      },
    });
    return Response.json(json);
  } catch (e) {
    // Generic 400 — no validator/secret leak (mirrors orders/posts routes, V7).
    // WR-02: the raw exception (handleUpload/token-broker internals, config or
    // token errors) must NEVER be echoed to an untrusted caller — log the detail
    // server-side only and return a static body.
    console.error('[blob/upload] token broker error:', e);
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
}
