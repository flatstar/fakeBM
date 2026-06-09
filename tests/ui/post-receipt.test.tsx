// @vitest-environment jsdom
/**
 * PROOF-01/02 — /post/[id] fake receipt + dual-photo submit gate.
 *
 * Renders PostClient (the 인증 작성 island) directly with orders-snapshot props
 * (mirrors the SC shell). Asserts:
 *
 *   - the fake receipt shows "실제 결제 ₩0" + "＊ 본 주문은 시키지 않았습니다 ＊"
 *     + the "안 먹음 인증 영수증" header + "강철 절제력" 결제수단 (PROOF-01).
 *   - snapshot-derived figures route through <Won> (item line ₩23,000 = 20000×1,
 *     결제 예정액 ₩23,000, 아낀 돈 ₩23,000) and <Num> (덜 먹은 1,640 kcal) —
 *     never an inline fmtWon (Pitfall 7).
 *   - with NO photos uploaded the "피드에 올리기" submit button is DISABLED
 *     (D-11 both photos required, Pitfall 4).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostClient } from '@/app/(mini)/post/[id]/_components/PostClient';

// useRouter is reached by the submit handler; stub it in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// @vercel/blob/client is browser-only; stub it so the import resolves in jsdom.
vi.mock('@vercel/blob/client', () => ({
  upload: vi.fn(async () => ({ url: 'https://x.public.blob.vercel-storage.com/proof/a.webp' })),
}));

const props = {
  orderId: 7,
  tgId: 99281932,
  restName: '밤9시 후라이드',
  orderNo: 'No.1234567',
  createdAtISO: '2026-06-09T11:00:00.000Z',
  items: [
    { id: 'm1', name: '황금올리브 한마리', emoji: '🍗', price: 20000, kcal: 1640, qty: 1 },
  ],
  total: 23000,
  savedAmount: 23000,
  kcal: 1640,
};

describe('/post/[id] receipt + submit gate (PROOF-01/02)', () => {
  it('renders the fake ₩0 receipt with the 안 먹음 인증 copy + 강철 절제력 결제수단', () => {
    render(<PostClient {...props} />);

    expect(screen.getByText('＊＊ 안 먹음 인증 영수증 ＊＊')).toBeDefined();
    expect(screen.getByText('실제 결제')).toBeDefined();
    expect(screen.getByText('₩0')).toBeDefined(); // virtual order, nothing charged
    expect(screen.getByText('＊ 본 주문은 시키지 않았습니다 ＊')).toBeDefined();
    expect(screen.getByText('강철 절제력')).toBeDefined();
    expect(screen.getByText('밤9시 후라이드')).toBeDefined();
  });

  it('routes snapshot ₩/kcal through Won/Num (₩23,000 line + total + payoff; 1,640 kcal)', () => {
    render(<PostClient {...props} />);

    // item line total (price×qty = 20000) via <Won>.
    expect(screen.getByText('₩20,000')).toBeDefined();
    // 결제 예정액 (line-through total) + 아낀 돈 payoff both show ₩23,000 via <Won>.
    expect(screen.getAllByText('₩23,000').length).toBeGreaterThanOrEqual(2);
    // 덜 먹은 kcal payoff via <Num>.
    expect(screen.getByText('1,640')).toBeDefined();
  });

  it('disables the 피드에 올리기 submit until both photos are uploaded (D-11)', () => {
    render(<PostClient {...props} />);

    const btn = screen.getByRole('button', { name: /피드에 올리기/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    // the sub-label nudges the user to upload both photos.
    expect(screen.getByText('두 사진을 모두 올려주세요')).toBeDefined();
  });
});
