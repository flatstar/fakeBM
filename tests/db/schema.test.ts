import { describe, it, expect } from 'vitest';
import { users } from '@/db/schema';

// Schema-shape assertions only — no live DB. Locks the D-06 theme contract and
// the AUTH-01 identity PK so a refactor can't silently drop them.
describe('users schema', () => {
  it('has tgId as the primary key (mapped to tg_id)', () => {
    expect(users.tgId.primary).toBe(true);
    expect(users.tgId.name).toBe('tg_id');
  });

  it('theme is an enum of coral|mint defaulting to coral (D-06)', () => {
    expect(users.theme.enumValues).toEqual(['coral', 'mint']);
    expect(users.theme.hasDefault).toBe(true);
    expect(users.theme.default).toBe('coral');
    expect(users.theme.notNull).toBe(true);
  });

  it('exposes username, firstName (first_name) and createdAt (created_at)', () => {
    expect(users.username.name).toBe('username');
    expect(users.firstName.name).toBe('first_name');
    expect(users.createdAt.name).toBe('created_at');
    expect(users.createdAt.hasDefault).toBe(true);
    expect(users.createdAt.notNull).toBe(true);
  });
});
