/**
 * lib/feed.ts — the SINGLE shared feed read query + keyset cursor codec
 * (FEED-01/02/04). The RSC `/feed` first page and `GET /api/feed` load-more
 * island BOTH call `feedPage` here, so the two surfaces can NEVER diverge — in
 * particular the visibility gate (hidden/deleted exclusion, T-04-04) lives in
 * exactly one WHERE clause (RESEARCH Pitfall 1/3).
 *
 * Author anonymity (T-04-05 / D-01/02/03): the query selects `tgId` but NEVER
 * joins the `users` table — the displayed handle is computed from `tgId` via
 * lib/handle.ts in the card. The Telegram username/firstName are never read here.
 *
 * Cursor opacity (T-04-06): the cursor is an opaque base64url blob of
 * `{c: createdAt.toISOString(), i: id}`. `decodeCursor` is defensive (try/catch
 * → null, never throws) so a tampered/garbage cursor degrades gracefully and is
 * only ever used as a Drizzle-parameterized WHERE bound (no injection).
 *
 * Keyset (FEED-02): order by `(createdAt DESC, id DESC)` and seek on the
 * composite `(createdAt, id)` tuple — `posts.createdAt` (defaultNow) is NOT
 * unique, so two same-tick posts must be disambiguated by the identity PK or the
 * page would drop/duplicate the tied rows. The N+1 probe (limit PAGE_SIZE + 1)
 * tells us whether a further page exists without a second COUNT query.
 */
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, likes } from '@/db/schema';

/** Page size for the feed (D-05 cursor note — discretion; tune later). */
export const PAGE_SIZE = 10;

/** The opaque cursor's decoded shape: the last kept row's keyset tuple. */
export interface FeedCursor {
  createdAt: Date;
  id: number;
}

/** A single feed row as rendered by FeedCard (no users join — tgId only). */
export interface FeedPost {
  id: number;
  tgId: number;
  restName: string;
  items: { id: string; name: string; emoji: string; price: number; kcal: number; qty: number }[];
  total: number;
  kcal: number;
  savedAmount: number;
  foodPhotoUrl: string;
  dietPhotoUrl: string;
  caption: string;
  diet: string;
  streakDay: number;
  createdAt: Date;
  /** Grouped like count, coalesced to 0 when the post has no likes (D-06). */
  likeCount: number;
  /** Whether the requesting viewer has liked this post (D-07). */
  liked: boolean;
}

export interface FeedPageResult {
  posts: FeedPost[];
  /** Opaque cursor for the next page, or null when this is the last page. */
  nextCursor: string | null;
}

/**
 * encodeCursor — opaque base64url of the row's keyset tuple. Keeps the wire
 * format compact and stops clients from hand-crafting cursors against the sort
 * internals (T-04-06).
 */
export function encodeCursor(r: FeedCursor): string {
  return Buffer.from(JSON.stringify({ c: r.createdAt.toISOString(), i: r.id })).toString(
    'base64url',
  );
}

/**
 * decodeCursor — defensive inverse of encodeCursor. Returns null (NEVER throws)
 * on a missing, malformed, or wrong-shape cursor so a tampered query param
 * degrades to "first page" semantics rather than a 500 (T-04-06).
 */
export function decodeCursor(s: string | null | undefined): FeedCursor | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as unknown;
    if (parsed === null || typeof parsed !== 'object') return null;
    const { c, i } = parsed as { c?: unknown; i?: unknown };
    if (typeof c !== 'string' || typeof i !== 'number' || !Number.isInteger(i)) return null;
    const createdAt = new Date(c);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: i };
  } catch {
    return null;
  }
}

/**
 * feedPage — the one shared feed query.
 *
 * @param cursor    decoded keyset cursor (null = first page)
 * @param viewerTgId the requesting user's Telegram id (drives the `liked` flag)
 * @returns the next PAGE_SIZE visible posts + an opaque nextCursor (null when
 *          there are no further pages).
 */
export async function feedPage(
  cursor: FeedCursor | null,
  viewerTgId: number,
): Promise<FeedPageResult> {
  // Like count, grouped once (D-06) — NOT N correlated subqueries.
  const likeCount = db
    .select({ postId: likes.postId, c: sql<number>`count(*)::int`.as('c') })
    .from(likes)
    .groupBy(likes.postId)
    .as('like_count');

  // Viewer's own likes, scoped to this viewer (D-07) — a cheap LEFT JOIN gives
  // the per-row `liked` flag without a round trip per card.
  const viewerLike = db
    .select({ postId: likes.postId })
    .from(likes)
    .where(eq(likes.tgId, viewerTgId))
    .as('viewer_like');

  // Composite (createdAt, id) keyset predicate — omitted on the first page.
  const keyset = cursor
    ? or(
        lt(posts.createdAt, cursor.createdAt),
        and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id)),
      )
    : undefined;

  const rows = await db
    .select({
      id: posts.id,
      tgId: posts.tgId,
      restName: posts.restName,
      items: posts.items,
      total: posts.total,
      kcal: posts.kcal,
      savedAmount: posts.savedAmount,
      foodPhotoUrl: posts.foodPhotoUrl,
      dietPhotoUrl: posts.dietPhotoUrl,
      caption: posts.caption,
      diet: posts.diet,
      streakDay: posts.streakDay,
      createdAt: posts.createdAt,
      likeCount: sql<number>`coalesce(${likeCount.c}, 0)`,
      liked: sql<boolean>`(${viewerLike.postId} is not null)`,
    })
    .from(posts)
    .leftJoin(likeCount, eq(likeCount.postId, posts.id))
    .leftJoin(viewerLike, eq(viewerLike.postId, posts.id))
    // T-04-04 visibility gate — hidden/deleted rows never reach any viewer.
    .where(and(isNull(posts.hiddenAt), isNull(posts.deletedAt), keyset))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(PAGE_SIZE + 1); // N+1 probe: an extra row ⇒ a further page exists.

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE) as FeedPost[];
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;

  return { posts: page, nextCursor };
}
