// @vitest-environment jsdom
/**
 * WAIT-01/02/04 — /wait/[id] DeliveryClient render.
 *
 * Renders the wait island directly with serializable props (as the SC shell
 * would). next/navigation is stubbed in jsdom. Asserts:
 *
 *   - the in-progress screen shows the 4-step stepper (접수/조리중/배달출발/곧도착),
 *     the server-deadline countdown ("도착까지" + 분), the craving meter, and the
 *     always-available demo skip (D-04).
 *   - the arrived branch shows "참기 성공!" and the savedAmount/kcal summary via
 *     <Won>/<Num> (₩23,000 / 1,640) — never an inline BM-font number.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryClient } from '@/app/(mini)/wait/[id]/_components/DeliveryClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const base = {
  orderId: 7,
  totalMs: 20 * 60_000,
  restName: '밤9시 후라이드',
  restEmoji: '🍗',
  savedAmount: 23000,
  kcal: 1640,
};

describe('/wait/[id] DeliveryClient', () => {
  it('in-progress: server-deadline countdown + 4-step stepper + craving + demo skip', () => {
    render(<DeliveryClient {...base} deadlineMs={Date.now() + base.totalMs} arrived={false} />);

    // 4-step stepper labels
    for (const k of ['접수', '조리중', '배달출발', '곧도착']) {
      expect(screen.getByText(k)).toBeDefined();
    }
    // countdown frame (server deadline driven) + craving meter
    expect(screen.getByText('도착까지', { exact: false })).toBeDefined();
    expect(screen.getByText('분')).toBeDefined();
    expect(screen.getByText('🤤 식욕 게이지')).toBeDefined();
    // demo skip is always available (D-04)
    expect(screen.getByText('데모: 바로 도착시키기 →')).toBeDefined();
    // not yet arrived
    expect(screen.queryByText('참기 성공!')).toBeNull();
  });

  it('arrived: 참기 성공! + savedAmount/kcal via Won/Num + 인증 CTA', () => {
    render(<DeliveryClient {...base} deadlineMs={Date.now() - 60_000} arrived={true} />);

    expect(screen.getByText('참기 성공!')).toBeDefined();
    // money/kcal through <Won>/<Num>
    expect(screen.getByText('₩23,000')).toBeDefined();
    expect(screen.getByText('1,640')).toBeDefined();
    // arrival CTA
    expect(screen.getByText('인증하러 가기')).toBeDefined();
    // in-progress chrome gone
    expect(screen.queryByText('데모: 바로 도착시키기 →')).toBeNull();
  });
});
