import { describe, it, expect } from 'vitest';
import { orders } from '@/db/schema';

// Schema-shape assertions only — no live DB. Locks the D-03 seed-snapshot shape,
// the D-04 server-authority money columns, and the D-05 server-generated
// orderNo/createdAt so a refactor can't silently drop or rename them.
describe('orders schema', () => {
  it('has id as the primary key', () => {
    expect(orders.id.primary).toBe(true);
  });

  it('tgId maps to tg_id, notNull (owner FK → users.tgId)', () => {
    expect(orders.tgId.name).toBe('tg_id');
    expect(orders.tgId.notNull).toBe(true);
  });

  it('items is a notNull jsonb snapshot column', () => {
    expect(orders.items.name).toBe('items');
    expect(orders.items.notNull).toBe(true);
  });

  it('restId/restName are notNull text snapshot columns', () => {
    expect(orders.restId.name).toBe('rest_id');
    expect(orders.restId.notNull).toBe(true);
    expect(orders.restName.name).toBe('rest_name');
    expect(orders.restName.notNull).toBe(true);
  });

  it('money + kcal columns are notNull (server-authoritative, D-04)', () => {
    expect(orders.subtotal.name).toBe('subtotal');
    expect(orders.subtotal.notNull).toBe(true);
    expect(orders.tip.name).toBe('tip');
    expect(orders.tip.notNull).toBe(true);
    expect(orders.total.name).toBe('total');
    expect(orders.total.notNull).toBe(true);
    expect(orders.kcal.name).toBe('kcal');
    expect(orders.kcal.notNull).toBe(true);
    expect(orders.savedAmount.name).toBe('saved_amount');
    expect(orders.savedAmount.notNull).toBe(true);
  });

  it('orderNo is a notNull text column (server-generated, D-05)', () => {
    expect(orders.orderNo.name).toBe('order_no');
    expect(orders.orderNo.notNull).toBe(true);
  });

  it('createdAt maps to created_at, notNull, defaults (defaultNow, D-05)', () => {
    expect(orders.createdAt.name).toBe('created_at');
    expect(orders.createdAt.hasDefault).toBe(true);
    expect(orders.createdAt.notNull).toBe(true);
  });
});
