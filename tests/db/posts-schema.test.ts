import { describe, it, expect } from 'vitest';
import { orders, posts } from '@/db/schema';

// Schema-shape assertions only — no live DB. Locks the Phase 3 substrate:
// the orders wait/arrival columns (D-03/05) and the posts reSnapshot + the
// D-10 order_id UNIQUE idempotency target. A refactor cannot silently drop or
// rename these without failing here.

describe('orders wait/arrival columns (D-03/05)', () => {
  it('waitStartedAt maps to wait_started_at, nullable timestamptz', () => {
    expect(orders.waitStartedAt.name).toBe('wait_started_at');
    expect(orders.waitStartedAt.notNull).toBe(false);
  });

  it('waitDeadline maps to wait_deadline, nullable (server authority)', () => {
    expect(orders.waitDeadline.name).toBe('wait_deadline');
    expect(orders.waitDeadline.notNull).toBe(false);
  });

  it('arrivedAt maps to arrived_at, nullable (arrive gate)', () => {
    expect(orders.arrivedAt.name).toBe('arrived_at');
    expect(orders.arrivedAt.notNull).toBe(false);
  });

  it('endured maps to endured, nullable boolean (undecided pre-arrival)', () => {
    expect(orders.endured.name).toBe('endured');
    expect(orders.endured.notNull).toBe(false);
  });
});

describe('posts schema (D-10/15/16/18)', () => {
  it('id is the primary key', () => {
    expect(posts.id.primary).toBe(true);
  });

  it('orderId maps to order_id, notNull and UNIQUE (D-10 one-per-order)', () => {
    expect(posts.orderId.name).toBe('order_id');
    expect(posts.orderId.notNull).toBe(true);
    expect(posts.orderId.isUnique).toBe(true);
  });

  it('tgId maps to tg_id, notNull (owner FK → users.tgId)', () => {
    expect(posts.tgId.name).toBe('tg_id');
    expect(posts.tgId.notNull).toBe(true);
  });

  it('reSnapshot columns (restName/items/total/kcal/savedAmount) are notNull (D-15)', () => {
    expect(posts.restName.name).toBe('rest_name');
    expect(posts.restName.notNull).toBe(true);
    expect(posts.items.name).toBe('items');
    expect(posts.items.notNull).toBe(true);
    expect(posts.total.notNull).toBe(true);
    expect(posts.kcal.notNull).toBe(true);
    expect(posts.savedAmount.name).toBe('saved_amount');
    expect(posts.savedAmount.notNull).toBe(true);
  });

  it('content columns (photo URLs/caption/diet) are notNull (D-11 both photos required)', () => {
    expect(posts.foodPhotoUrl.name).toBe('food_photo_url');
    expect(posts.foodPhotoUrl.notNull).toBe(true);
    expect(posts.dietPhotoUrl.name).toBe('diet_photo_url');
    expect(posts.dietPhotoUrl.notNull).toBe(true);
    expect(posts.caption.notNull).toBe(true);
    expect(posts.diet.notNull).toBe(true);
  });

  it('박제 columns (streakDay/endured) are notNull (D-16/18)', () => {
    expect(posts.streakDay.name).toBe('streak_day');
    expect(posts.streakDay.notNull).toBe(true);
    expect(posts.endured.name).toBe('endured');
    expect(posts.endured.notNull).toBe(true);
  });

  it('createdAt maps to created_at, notNull, defaults (defaultNow)', () => {
    expect(posts.createdAt.name).toBe('created_at');
    expect(posts.createdAt.notNull).toBe(true);
    expect(posts.createdAt.hasDefault).toBe(true);
  });
});
