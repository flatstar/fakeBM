/**
 * lib/stats.ts — the SINGLE owner-scoped aggregation core for Phase 5 (STATS-01..04).
 *
 * Two halves, deliberately split so the date/JSON math is the Nyquist test seam:
 *
 *  1. PURE functions (no DB, no live clock — `now` is always a parameter):
 *     - kstMonthBounds(now)            → KST calendar-month [startUtc, endUtc)
 *     - bucketWeekByKstWeekday(rows,now) → length-7 Mon-first weekday buckets
 *     - topMenuName(itemsRows)         → most-frequent items[].name (NOT category)
 *     - recomputeCurrentStreak(now,prev) → live streak from the latest endured post
 *     - riceBowls / movieTickets       → D-07 conversions
 *     - RICE_KCAL / MOVIE_WON          → D-07 constants
 *
 *  2. Owner-scoped DB reads over the FROZEN `posts` columns (read-only, neon-http
 *     single-shot — no transaction). EVERY read WHERE is owner-scoped on `tgId`
 *     (T-05-01, the dominant phase threat — no user-supplied id ever selects data)
 *     AND carries ONE centralized visibility predicate (Pitfall 5):
 *       - exclude deletedAt IS NOT NULL (operator soft-delete)
 *       - INCLUDE hiddenAt (still the owner's own restraint record)
 *
 * All KST math single-sources through lib/streak.ts (fixed +09:00 offset, no DST)
 * — we NEVER call Date.getMonth()/getDay() on a UTC instant (Pitfall 1/2).
 *
 * computeStreak is LIFTED here from app/api/posts/route.ts so the proof route and
 * the live stats display share ONE streak definition (D-04).
 */
import { and, desc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, likes } from '@/db/schema';
import { kstDateKey, nextStreak } from '@/lib/streak';
import {
  decodeCursor,
  encodeCursor,
  PAGE_SIZE,
  type FeedCursor,
  type FeedPageResult,
  type FeedPost,
} from '@/lib/feed';

const KST_OFFSET_MS = 9 * 60 * 60_000; // +09:00 fixed (no DST in Korea) — mirrors lib/streak.

// ────────────────────────────────────────────────────────────────────────────
// Conversion constants (D-07) — isolated so they're one-line tunable.
// ────────────────────────────────────────────────────────────────────────────

/** 공깃밥 환산: rice = round(kcalTotal / RICE_KCAL). */
export const RICE_KCAL = 300;
/** 영화 환산: movies = floor(savedTotal / MOVIE_WON). */
export const MOVIE_WON = 15000;

/** 덜 먹은 kcal → 공깃밥 그릇 수 (round). Empty (0) → 0, never NaN (Pitfall 6). */
export function riceBowls(kcalTotal: number): number {
  return Math.round(kcalTotal / RICE_KCAL);
}

/** 아낀 돈 → 영화 티켓 수 (floor). Empty (0) → 0 (Pitfall 6). */
export function movieTickets(savedTotal: number): number {
  return Math.floor(savedTotal / MOVIE_WON);
}

// ────────────────────────────────────────────────────────────────────────────
// PURE date/JSON aggregation (the test seam)
// ────────────────────────────────────────────────────────────────────────────

/**
 * kstMonthBounds — the half-open [startUtc, endUtc) UTC instants bracketing the
 * KST calendar month that `now` falls in (Pitfall 1, off-by-9h-safe).
 *
 * We add the +09:00 offset, read the KST calendar Y/M from that shifted value
 * using the UTC getters (so an instant 30 min into a KST month is correctly that
 * month even though it's still the PREVIOUS UTC day), then build the month-start
 * UTC instant by subtracting the offset back. NEVER raw Date.getMonth() on the
 * unshifted UTC instant.
 *
 * start = KST month 1st 00:00 (as a UTC instant); end = next KST month 1st 00:00
 * (exclusive). A post at the last KST ms of the month is inside; the first ms of
 * the next month equals `endUtc` and is excluded.
 */
export function kstMonthBounds(now: Date): { startUtc: Date; endUtc: Date } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth(); // 0-based KST month (read off the shifted value)
  // KST month 1st 00:00, expressed back in UTC by subtracting the offset.
  const startUtc = new Date(Date.UTC(y, m, 1) - KST_OFFSET_MS);
  // Next KST month 1st 00:00 (Date.UTC rolls Dec→next Jan automatically).
  const endUtc = new Date(Date.UTC(y, m + 1, 1) - KST_OFFSET_MS);
  return { startUtc, endUtc };
}

/**
 * KST weekday index, Mon-first: 0=월 … 6=일 (Pitfall 2). Derived from the KST
 * calendar date string (single-sourced via kstDateKey), NOT raw getDay() on the
 * UTC instant. `Date.UTC` of the KST date gives the weekday with JS 0=Sun, which
 * we remap to Mon-first.
 */
function kstWeekdayMonFirst(d: Date): number {
  const key = kstDateKey(d); // 'YYYY-MM-DD' in KST
  const jsDay = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  return (jsDay + 6) % 7; // 0=Mon … 6=Sun
}

/** A row the weekly bucket consumes — only the instant + the amount to sum. */
export interface WeekBucketRow {
  createdAt: Date;
  savedAmount: number;
}

/**
 * bucketWeekByKstWeekday — sum each row's savedAmount into a length-7 array
 * indexed 0=월(Mon) … 6=일(Sun), for the KST week (Mon-anchored) containing
 * `now`. Future weekdays (after KST today) stay 0 (D-06). Rows outside this KST
 * week are excluded. Pure: no DB, no live clock.
 */
export function bucketWeekByKstWeekday(rows: WeekBucketRow[], now: Date): number[] {
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  const todayIdx = kstWeekdayMonFirst(now);
  // This KST week's Monday 00:00 (KST), as a UTC instant, and the exclusive end
  // (next Monday 00:00 KST). Built from the KST date key so the boundary is the
  // KST midnight, not the UTC one.
  const todayKey = kstDateKey(now);
  const todayMidnightUtcMs = Date.parse(`${todayKey}T00:00:00Z`) - KST_OFFSET_MS;
  const weekStartMs = todayMidnightUtcMs - todayIdx * 86_400_000; // Monday 00:00 KST
  const weekEndMs = weekStartMs + 7 * 86_400_000; // next Monday 00:00 KST (exclusive)

  for (const r of rows) {
    const t = r.createdAt.getTime();
    if (t < weekStartMs || t >= weekEndMs) continue; // outside this KST week
    const idx = kstWeekdayMonFirst(r.createdAt);
    if (idx > todayIdx) continue; // future weekday → stays 0 (D-06)
    buckets[idx] += r.savedAmount;
  }
  return buckets;
}

/** A row the topMenu count consumes — only the frozen items snapshot. */
export interface ItemsRow {
  items: { name: string }[];
}

/**
 * topMenuName — the most-frequent items[].name across all rows (D-08).
 *
 * Counts by NAME, never by a category field (the prototype's category logic is a
 * trap — do not port it). Empty input / no items → null (Pitfall 6 empty-state).
 * Tie-break is deterministic: among equal counts, the lexicographically smallest
 * name wins, so the winner does not depend on row/input order.
 */
export function topMenuName(rows: ItemsRow[]): string | null {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const it of r.items ?? []) {
      counts.set(it.name, (counts.get(it.name) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, c] of counts) {
    if (c > bestCount || (c === bestCount && best !== null && name < best)) {
      best = name;
      bestCount = c;
    }
  }
  return best;
}

/**
 * recomputeCurrentStreak — the PURE live-streak recompute (D-04 / Pitfall 3).
 *
 * Given `now` and this owner's latest endured post (or null), apply the shared
 * nextStreak with thisEndured=true: a latest endured post on yesterday(KST)
 * holds/extends the chain, today holds it, 2+ KST days stale resets to 0, and no
 * prior post → 0. This is the math `currentStreak(tgId)` wraps around its DB read
 * — exposed pure so the suite asserts the recompute without a live clock or Neon.
 */
export function recomputeCurrentStreak(
  now: Date,
  prevEndured: { createdAt: Date; streakDay: number } | null,
): number {
  if (!prevEndured) return 0;
  // If the latest endured day is older than yesterday(KST), the live chain is
  // broken → 0. nextStreak resets to 1 in that case (it's computing the NEXT
  // post's streakDay), but the LIVE display streak of a stale chain is 0.
  const today = kstDateKey(now);
  const last = kstDateKey(prevEndured.createdAt);
  const diffDays = Math.round((Date.parse(today) - Date.parse(last)) / 86_400_000);
  if (diffDays >= 2 || diffDays < 0) return 0; // stale (or somehow future) → broken
  // diffDays 0 (today) or 1 (yesterday) → the chain is live: hold/extend it.
  return nextStreak(now, prevEndured, true);
}

// ────────────────────────────────────────────────────────────────────────────
// Owner-scoped DB reads (read-only, neon-http single-shot)
// ────────────────────────────────────────────────────────────────────────────

/**
 * The ONE visibility predicate, centralized so all stats reads share it (Pitfall
 * 5): exclude operator soft-deleted posts; INCLUDE report-hidden (hiddenAt) posts
 * — those are still the owner's own restraint record. Combined with the
 * owner-scope eq(posts.tgId, uid) on EVERY read (T-05-01, no user-supplied id).
 */
function visibleOwned(uid: number) {
  return and(eq(posts.tgId, uid), sql`${posts.deletedAt} is null`);
}

/** The owner's server-authority scalar totals (D-01/02). resisted = COUNT(*). */
export interface UserTotals {
  savedTotal: number;
  kcalTotal: number;
  resisted: number;
  savedMonth: number;
}

/**
 * userTotals — owner-scoped scalar aggregate over the visible posts (D-01/02/03).
 *
 * savedTotal/kcalTotal are SUMs (coalesced to 0 on empty — Pitfall 6), resisted
 * is COUNT(*) (번 참음, D-01), savedMonth is the saved-amount SUM restricted to
 * THIS KST calendar month via the kstMonthBounds [startUtc, endUtc) params (D-03).
 *
 * Done as two trivially-correct selects (RESEARCH A1 fallback): one unrestricted
 * over all visible owned rows, one with the month-bound WHERE — both owner-scoped,
 * both using the verified `sql<number>\`coalesce(...)::int\`` / `count(*)::int`
 * idiom from lib/feed.ts. No `filter (where)` aggregate is assumed against PG.
 */
export async function userTotals(uid: number, now: Date = new Date()): Promise<UserTotals> {
  const [agg] = await db
    .select({
      savedTotal: sql<number>`coalesce(sum(${posts.savedAmount}), 0)::int`,
      kcalTotal: sql<number>`coalesce(sum(${posts.kcal}), 0)::int`,
      resisted: sql<number>`count(*)::int`,
    })
    .from(posts)
    .where(visibleOwned(uid));

  const { startUtc, endUtc } = kstMonthBounds(now);
  const [monthAgg] = await db
    .select({
      savedMonth: sql<number>`coalesce(sum(${posts.savedAmount}), 0)::int`,
    })
    .from(posts)
    .where(and(visibleOwned(uid), gte(posts.createdAt, startUtc), lt(posts.createdAt, endUtc)));

  return {
    savedTotal: agg?.savedTotal ?? 0,
    kcalTotal: agg?.kcalTotal ?? 0,
    resisted: agg?.resisted ?? 0,
    savedMonth: monthAgg?.savedMonth ?? 0,
  };
}

/**
 * weekRows — owner-scoped fetch of the (createdAt, savedAmount) rows the pure
 * bucketWeekByKstWeekday consumes. Visibility + owner-scope applied; the weekday
 * bucketing/future-cutoff happens in JS (the pure fn), not SQL (RESEARCH A2).
 */
export async function weekRows(uid: number): Promise<WeekBucketRow[]> {
  return db
    .select({ createdAt: posts.createdAt, savedAmount: posts.savedAmount })
    .from(posts)
    .where(visibleOwned(uid))
    .orderBy(desc(posts.createdAt));
}

/**
 * allItemsRows — owner-scoped fetch of the frozen items snapshots the pure
 * topMenuName consumes. Visibility + owner-scope applied.
 */
export async function allItemsRows(uid: number): Promise<ItemsRow[]> {
  return db
    .select({ items: posts.items })
    .from(posts)
    .where(visibleOwned(uid));
}

/**
 * computeStreak — the DB-touching streak wrapper (LIFTED from app/api/posts/route.ts,
 * D-04). Selects this owner's latest endured post and applies the pure nextStreak
 * (KST). A skipped (endured=false) arrival yields 0. This is the SINGLE shared
 * definition — the posts proof route re-imports it from here.
 *
 * NOTE: owner-scoped on tgId AND endured=true; visibility is intentionally NOT
 * applied here because the streak chain at WRITE time considers every endured
 * post regardless of later hide/delete (matches the route's pre-lift behavior —
 * no behavior change).
 */
export async function computeStreak(tgId: number, thisEndured: boolean): Promise<number> {
  if (!thisEndured) return 0; // short-circuit (nextStreak would also return 0).
  const prev = await db
    .select({ createdAt: posts.createdAt, streakDay: posts.streakDay })
    .from(posts)
    .where(and(eq(posts.tgId, tgId), eq(posts.endured, true)))
    .orderBy(desc(posts.createdAt))
    .limit(1);
  return nextStreak(new Date(), prev[0] ?? null, thisEndured);
}

/**
 * currentStreak — the LIVE current-streak for the owner's stats display (D-04 /
 * Pitfall 3). Selects the latest endured post (owner-scoped) and applies the pure
 * recomputeCurrentStreak so a chain that broke (latest endured 2+ KST days ago)
 * shows 0 rather than the frozen streakDay.
 */
export async function currentStreak(uid: number, now: Date = new Date()): Promise<number> {
  const prev = await db
    .select({ createdAt: posts.createdAt, streakDay: posts.streakDay })
    .from(posts)
    .where(and(eq(posts.tgId, uid), eq(posts.endured, true)))
    .orderBy(desc(posts.createdAt))
    .limit(1);
  return recomputeCurrentStreak(now, prev[0] ?? null);
}

/**
 * ownerRecordsPage — the owner-scoped per-user 인증 records page (STATS-05 / D-11).
 *
 * A `feedPage` VARIANT for the /my own-records list: it returns the SAME
 * FeedPost/FeedPageResult shape lib/feed.ts feedPage returns, so the existing
 * FeedCard renders the rows unchanged (in readOnly mode). Three differences from
 * the public feed read, all deliberate:
 *
 *  1. OWNER-SCOPE (T-05-06, the dominant /my threat): the WHERE adds
 *     `eq(posts.tgId, uid)` so the page only ever returns THIS user's posts — no
 *     user-supplied id selects another user's records (IDOR control). `uid` is
 *     the session tgId from requireSession(), never a request param.
 *  2. CENTRALIZED VISIBILITY (Pitfall 5, consistent with userTotals): exclude
 *     operator soft-deleted (`deletedAt is null`) but INCLUDE report-hidden
 *     (`hiddenAt`) — a hidden post is still the OWNER'S own restraint record on
 *     their private screen. This intentionally differs from the public feed gate
 *     (which also excludes hiddenAt) and matches the stats visibility predicate.
 *  3. CURSOR REUSE (T-05-08): the keyset codec is REUSED from lib/feed
 *     (decode/encodeCursor) — NOT duplicated — so a forged cursor degrades to
 *     "first page" (decodeCursor → null, never throws) and the bound is always
 *     Drizzle-parameterized. This read targets `posts_tg_created_idx` (schema).
 *
 * The cursor argument is the opaque string (decoded here via decodeCursor); the
 * `liked`/`likeCount` fields are still computed (cheap LEFT JOINs) so the
 * FeedPost type holds and the readOnly card — which renders neither — is fed a
 * well-typed row.
 *
 * @param uid    the owner's Telegram id (session-derived — owner scope)
 * @param cursor the opaque next-page cursor (undefined/null/garbage = first page)
 */
export async function ownerRecordsPage(
  uid: number,
  cursor?: string | null,
): Promise<FeedPageResult> {
  const decoded: FeedCursor | null = decodeCursor(cursor);

  // Like count, grouped once (mirrors feedPage) — NOT N correlated subqueries.
  const likeCount = db
    .select({ postId: likes.postId, c: sql<number>`count(*)::int`.as('c') })
    .from(likes)
    .groupBy(likes.postId)
    .as('like_count');

  // The owner's own likes on their own posts (the viewer === the owner here).
  const viewerLike = db
    .select({ postId: likes.postId })
    .from(likes)
    .where(eq(likes.tgId, uid))
    .as('viewer_like');

  // Composite (createdAt, id) keyset predicate — omitted on the first page.
  const keyset = decoded
    ? or(
        lt(posts.createdAt, decoded.createdAt),
        and(eq(posts.createdAt, decoded.createdAt), lt(posts.id, decoded.id)),
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
    // OWNER-SCOPE (eq(posts.tgId, uid)) + the centralized visibility predicate
    // (exclude deletedAt, INCLUDE hiddenAt — same as userTotals/visibleOwned).
    .where(and(eq(posts.tgId, uid), isNull(posts.deletedAt), keyset))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(PAGE_SIZE + 1); // N+1 probe: an extra row ⇒ a further page exists.

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE) as FeedPost[];
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;

  return { posts: page, nextCursor };
}
