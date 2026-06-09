/**
 * app/(mini)/wait/[id]/page.tsx — the fake-delivery wait screen shell (WAIT-01,
 * D-01 route). Async server component.
 *
 * IDOR guard (T-3-06, HIGH): the integer route id is guessable/sequential, so the
 * SELECT is ALWAYS owner-scoped — `and(eq(orders.id, idNum), eq(orders.tgId,
 * tgId))`. A missing session, a non-integer id, or no owner-match all collapse to
 * notFound() — a non-owner cannot tell an order apart from a non-existent one.
 *
 * Deadline ensure (D-03/07, RESEARCH Open Q3): the wait is server-authoritative.
 * If this is the first visit (waitDeadline null) the SC stamps it inline with an
 * isNull-guarded UPDATE — no extra round-trip — so the deadline survives an app
 * close and a re-entry can never reset it (T-3-07). The client only counts down
 * to the deadline for display; the arrive route re-judges on the server clock.
 *
 * Re-entry (D-10): if the order already arrived AND a post exists, this wait is
 * done — redirect to /post/[id] rather than replay the animation.
 *
 * Money HARD RULE (Pitfall 7): the arrival summary's ₩/kcal route through
 * <Won>/<Num> inside DeliveryClient — never an inline BM-font span.
 */
import type { ReactElement } from 'react';
import { notFound, redirect } from 'next/navigation';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, posts } from '@/db/schema';
import { WAIT_MS } from '@/lib/wait';
import { DeliveryClient } from './_components/DeliveryClient';

export default async function WaitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params; // Next 16: dynamic params is a Promise.

  // Auth + id validation collapse to notFound (no info leak, T-3-06).
  const tgId = await requireSession();
  if (!tgId) notFound();

  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  // T-3-06 IDOR guard: owner-scoped read — id AND tgId must match. Never id-only.
  let [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
  if (!order) notFound();

  // D-10 re-entry: an already-arrived order with a post is finished — go to it.
  if (order.arrivedAt) {
    const [post] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.orderId, idNum), eq(posts.tgId, tgId)));
    if (post) redirect(`/post/${idNum}`);
  }

  // D-03/07 deadline ensure: stamp the server deadline once (isNull-guarded), so
  // a re-entry never resets the clock. Re-read the row to carry the fresh value.
  if (!order.waitDeadline) {
    const interval = sql`(${Math.round(WAIT_MS / 1000)} * interval '1 second')`;
    await db
      .update(orders)
      .set({ waitStartedAt: sql`now()`, waitDeadline: sql`now() + ${interval}` })
      .where(
        and(eq(orders.id, idNum), eq(orders.tgId, tgId), isNull(orders.waitDeadline)),
      );
    [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
  }

  // The deadline is now guaranteed set. Pass serializable props into the island.
  return (
    <DeliveryClient
      orderId={order.id}
      deadlineMs={order.waitDeadline!.getTime()}
      totalMs={WAIT_MS}
      restName={order.restName}
      restEmoji={order.items[0]?.emoji ?? '🍔'}
      savedAmount={order.savedAmount}
      kcal={order.kcal}
      arrived={Boolean(order.arrivedAt)}
    />
  );
}
