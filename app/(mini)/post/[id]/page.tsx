/**
 * app/(mini)/post/[id]/page.tsx — the 인증 작성 shell (PROOF-01..04). Async
 * server component.
 *
 * IDOR guard (T-3-12, HIGH): the integer route id is guessable/sequential, so the
 * SELECT is ALWAYS owner-scoped — `and(eq(orders.id, idNum), eq(orders.tgId,
 * tgId))`. A missing session, a non-integer id, or no owner-match all collapse to
 * notFound() — a non-owner cannot tell an order apart from a non-existent one.
 *
 * Entry guards (D-08/10):
 *   - the order must have ARRIVED (arrivedAt set) — otherwise the wait isn't over,
 *     so we redirect to /wait/[id] (the user can't prove resisting mid-wait, D-09).
 *   - the order must NOT already have a post (order_id UNIQUE, D-10) — a re-entry
 *     after posting redirects home (Phase 4 feed) rather than offering a duplicate.
 *
 * The fake receipt is rendered from the orders SNAPSHOT columns (restName/items/
 * total/savedAmount/kcal frozen at order time, D-14) — never an ALL_MENU re-lookup.
 * The CC island (PostClient) does the dual upload + diet/caption + submit.
 *
 * Money HARD RULE (Pitfall 7): the receipt/payoff ₩/kcal route through <Won>/<Num>
 * inside PostClient — never an inline BM-font span.
 */
import type { ReactElement } from 'react';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { SubBar } from '@/components/SubBar';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, posts } from '@/db/schema';
import { PostClient } from './_components/PostClient';

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params; // Next 16: dynamic params is a Promise.

  // Auth + id validation collapse to notFound (no info leak, T-3-12).
  const tgId = await requireSession();
  if (!tgId) notFound();

  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  // T-3-12 IDOR guard: owner-scoped read — id AND tgId must match. Never id-only.
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
  if (!order) notFound();

  // D-08 entry gate: the order must have arrived (the wait is over). Mid-wait →
  // back to the wait screen — a proof can't be written before arrival (D-09).
  if (!order.arrivedAt) redirect(`/wait/${idNum}`);

  // D-10 entry gate: one post per order. An already-posted order → feed, never a
  // duplicate write form (the API would 409 anyway, but don't offer it).
  const [existing] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.orderId, idNum), eq(posts.tgId, tgId)));
  if (existing) redirect('/');

  return (
    <>
      <SubBar title="인증 올리기" />
      <PostClient
        orderId={order.id}
        restName={order.restName}
        orderNo={order.orderNo}
        createdAtISO={order.createdAt.toISOString()}
        items={order.items}
        total={order.total}
        savedAmount={order.savedAmount}
        kcal={order.kcal}
      />
    </>
  );
}
