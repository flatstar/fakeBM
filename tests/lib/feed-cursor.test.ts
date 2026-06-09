import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '@/lib/feed';

// FEED-02 keyset cursor codec. The codec (encodeCursor/decodeCursor over
// {createdAt, id}) is the opaque base64url wire format shared by the RSC page
// and GET /api/feed. Round-trip integrity + defensive decode (null, never throw)
// are the correctness requirements: a same-tick createdAt tie must still be
// disambiguated by id, and a tampered/garbage cursor must degrade gracefully.

describe('lib/feed cursor codec (FEED-02)', () => {
  it('round-trips {createdAt, id} through encode → decode', () => {
    const cursor = { createdAt: new Date('2026-06-09T03:00:00Z'), id: 42 };
    const decoded = decodeCursor(encodeCursor(cursor));
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(42);
    expect(decoded!.createdAt.toISOString()).toBe('2026-06-09T03:00:00.000Z');
  });

  it('preserves the id tiebreaker for same-millisecond createdAt rows', () => {
    const at = new Date('2026-06-09T03:00:00.000Z');
    const a = decodeCursor(encodeCursor({ createdAt: at, id: 100 }));
    const b = decodeCursor(encodeCursor({ createdAt: at, id: 99 }));
    expect(a!.createdAt.toISOString()).toBe(b!.createdAt.toISOString());
    expect(a!.id).toBe(100);
    expect(b!.id).toBe(99);
  });

  it('decodes a malformed base64 string to null (never throws)', () => {
    expect(decodeCursor('not-a-valid-cursor!!!')).toBeNull();
    expect(decodeCursor('')).toBeNull();
    // Valid base64 but not the expected {c,i} JSON shape → null.
    expect(decodeCursor(Buffer.from('{"x":1}').toString('base64url'))).toBeNull();
    // Right keys, wrong types → null.
    expect(decodeCursor(Buffer.from('{"c":1,"i":"x"}').toString('base64url'))).toBeNull();
    // A non-ISO createdAt string → null (NaN date).
    expect(decodeCursor(Buffer.from('{"c":"nope","i":1}').toString('base64url'))).toBeNull();
  });

  it('decodes null/undefined to null', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});
