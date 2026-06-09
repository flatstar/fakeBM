import { describe, it, expect } from 'vitest';

// Wave-0 scaffold for the keyset cursor codec (FEED-02). The codec
// (encodeCursor/decodeCursor over {createdAt, id}) is implemented in lib/feed.ts
// in Plan 04-02 — it does NOT exist yet. These assertions are authored now so
// Plan 02 implements against them. The suite is SKIPPED so the file stages green
// without a broken import; Plan 02 must:
//   1. add `import { encodeCursor, decodeCursor } from '@/lib/feed';`
//   2. delete the local placeholders below
//   3. change describe.skip → describe
//
// TODO(04-02): wire to lib/feed.ts and un-skip.

// --- placeholder contract (replaced by the lib/feed.ts import in Plan 02) ---
type Cursor = { createdAt: Date; id: number };
const encodeCursor: (c: Cursor) => string = () => {
  throw new Error('TODO(04-02): implement in lib/feed.ts');
};
const decodeCursor: (raw: string) => Cursor | null = () => {
  throw new Error('TODO(04-02): implement in lib/feed.ts');
};

describe.skip('lib/feed cursor codec (FEED-02)', () => {
  it('round-trips {createdAt, id} through encode → decode', () => {
    const cursor: Cursor = { createdAt: new Date('2026-06-09T03:00:00Z'), id: 42 };
    const decoded = decodeCursor(encodeCursor(cursor));
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(42);
    expect(decoded!.createdAt.toISOString()).toBe('2026-06-09T03:00:00.000Z');
  });

  it('decodes a malformed base64 string to null (never throws)', () => {
    expect(decodeCursor('not-a-valid-cursor!!!')).toBeNull();
    expect(decodeCursor('')).toBeNull();
    // Valid base64 but not the expected {createdAt,id} JSON shape → null.
    expect(decodeCursor(Buffer.from('{"x":1}').toString('base64url'))).toBeNull();
  });
});
