// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { shares } from '@/db/schema';

// Schema-shape assertions only — no live DB. Locks the Phase 6 substrate:
// the D-03 OPAQUE text PK (T-06-01 — a sequential int must never be
// reintroduced), the frozen snapshot scalars (D-01/02), the length-7 byDay
// jsonb, and the nullable topMenu/ogUrl slots (D-05 Blob cache kept now so no
// later migration). A refactor cannot silently change these without failing here.

describe('shares schema (Phase 6 substrate)', () => {
  it('id is an OPAQUE text primary key (D-03 / T-06-01 — NOT a sequential int identity)', () => {
    expect(shares.id.name).toBe('id');
    expect(shares.id.primary).toBe(true);
    // The security-critical assertion: the column is text, never an
    // integer generatedAlwaysAsIdentity (which would be enumerable).
    expect(shares.id.columnType).toBe('PgText');
    expect(shares.id.dataType).toBe('string');
    expect(shares.id.hasDefault).toBe(false); // filled by crypto.randomUUID in the API
  });

  it('tgId maps to tg_id, notNull (owner FK → users.tgId)', () => {
    expect(shares.tgId.name).toBe('tg_id');
    expect(shares.tgId.notNull).toBe(true);
  });

  it('monthLabel is a notNull text snapshot column', () => {
    expect(shares.monthLabel.name).toBe('month_label');
    expect(shares.monthLabel.notNull).toBe(true);
    expect(shares.monthLabel.columnType).toBe('PgText');
  });

  it('frozen stat scalars (savedMonth/savedTotal/kcalTotal/resisted/streak) are notNull integers (D-01/02)', () => {
    expect(shares.savedMonth.name).toBe('saved_month');
    expect(shares.savedMonth.notNull).toBe(true);
    expect(shares.savedTotal.name).toBe('saved_total');
    expect(shares.savedTotal.notNull).toBe(true);
    expect(shares.kcalTotal.name).toBe('kcal_total');
    expect(shares.kcalTotal.notNull).toBe(true);
    expect(shares.resisted.name).toBe('resisted');
    expect(shares.resisted.notNull).toBe(true);
    expect(shares.streak.name).toBe('streak');
    expect(shares.streak.notNull).toBe(true);
  });

  it('byDay maps to by_day, notNull jsonb (length-7 int[])', () => {
    expect(shares.byDay.name).toBe('by_day');
    expect(shares.byDay.notNull).toBe(true);
    expect(shares.byDay.columnType).toBe('PgJsonb');
  });

  it('topMenu maps to top_menu, NULLABLE (topMenuName → null)', () => {
    expect(shares.topMenu.name).toBe('top_menu');
    expect(shares.topMenu.notNull).toBe(false);
  });

  it('ogUrl maps to og_url, NULLABLE (D-05 Blob cache slot kept now, no later migration)', () => {
    expect(shares.ogUrl.name).toBe('og_url');
    expect(shares.ogUrl.notNull).toBe(false);
  });

  it('createdAt maps to created_at, notNull, defaults (defaultNow)', () => {
    expect(shares.createdAt.name).toBe('created_at');
    expect(shares.createdAt.notNull).toBe(true);
    expect(shares.createdAt.hasDefault).toBe(true);
  });
});
