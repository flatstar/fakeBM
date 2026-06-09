import { describe, it, expect } from 'vitest';
import { likes, reports, posts } from '@/db/schema';

// Schema-shape assertions only — no live DB. Locks the Phase 4 substrate: the
// likes/reports tables (composite PK = onConflictDoNothing target), the reason
// enum (D-12), the posts visibility columns (nullable, default visible), and the
// composite (createdAt, id) keyset index. A refactor cannot silently drop or
// rename these without failing here.

describe('likes table (FEED-03 / D-05/06)', () => {
  it('postId maps to post_id, notNull (FK → posts.id)', () => {
    expect(likes.postId.name).toBe('post_id');
    expect(likes.postId.notNull).toBe(true);
  });

  it('tgId maps to tg_id, notNull (FK → users.tgId)', () => {
    expect(likes.tgId.name).toBe('tg_id');
    expect(likes.tgId.notNull).toBe(true);
  });

  it('createdAt maps to created_at, notNull, defaultNow', () => {
    expect(likes.createdAt.name).toBe('created_at');
    expect(likes.createdAt.notNull).toBe(true);
    expect(likes.createdAt.hasDefault).toBe(true);
  });

  it('has a composite primary key on (postId, tgId) — the idempotency target (D-05)', () => {
    expect(getPk(likes)).toEqual([['post_id', 'tg_id']]);
  });
});

describe('reports table (FEED-05 / D-11/12)', () => {
  it('postId maps to post_id, notNull (FK → posts.id)', () => {
    expect(reports.postId.name).toBe('post_id');
    expect(reports.postId.notNull).toBe(true);
  });

  it('tgId maps to tg_id, notNull (FK → users.tgId)', () => {
    expect(reports.tgId.name).toBe('tg_id');
    expect(reports.tgId.notNull).toBe(true);
  });

  it('reason maps to reason, notNull, enum [spam, inappropriate, hate, other] (D-12)', () => {
    expect(reports.reason.name).toBe('reason');
    expect(reports.reason.notNull).toBe(true);
    expect(reports.reason.enumValues).toEqual([
      'spam',
      'inappropriate',
      'hate',
      'other',
    ]);
  });

  it('createdAt maps to created_at, notNull, defaultNow', () => {
    expect(reports.createdAt.name).toBe('created_at');
    expect(reports.createdAt.notNull).toBe(true);
    expect(reports.createdAt.hasDefault).toBe(true);
  });

  it('has a composite primary key on (postId, tgId) — one report per (post, user) (D-11)', () => {
    expect(getPk(reports)).toEqual([['post_id', 'tg_id']]);
  });
});

describe('posts visibility columns (D-10/16)', () => {
  it('hiddenAt maps to hidden_at, nullable (default visible)', () => {
    expect(posts.hiddenAt.name).toBe('hidden_at');
    expect(posts.hiddenAt.notNull).toBe(false);
  });

  it('deletedAt maps to deleted_at, nullable (operator soft delete)', () => {
    expect(posts.deletedAt.name).toBe('deleted_at');
    expect(posts.deletedAt.notNull).toBe(false);
  });
});

describe('posts_created_idx composite keyset (FEED-02)', () => {
  it('is declared on (created_at, id) — both columns present', () => {
    const cols = getIndexCols(posts, 'posts_created_idx');
    expect(cols).toContain('created_at');
    expect(cols).toContain('id');
    expect(cols).toEqual(['created_at', 'id']);
  });
});

// --- helpers: read composite PK + index columns via drizzle table config ---
// getTableConfig returns the runtime descriptor (primaryKeys[].columns[].name,
// indexes[].config.columns[].name) — the only reliable way to assert composite
// PKs / multi-column indexes without a live DB.
import { getTableConfig } from 'drizzle-orm/pg-core';

function getPk(table: Parameters<typeof getTableConfig>[0]): string[][] {
  const { primaryKeys } = getTableConfig(table);
  return primaryKeys.map((pk) => pk.columns.map((c) => c.name));
}

function getIndexCols(
  table: Parameters<typeof getTableConfig>[0],
  idxName: string,
): string[] {
  const { indexes } = getTableConfig(table);
  const idx = indexes.find((i) => i.config.name === idxName);
  if (!idx) throw new Error(`index ${idxName} not found`);
  return idx.config.columns.map((c) =>
    'name' in c ? (c as { name: string }).name : String(c),
  );
}
