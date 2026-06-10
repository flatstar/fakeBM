// @vitest-environment jsdom
/**
 * tests/ui/loading-skeletons.test.tsx — Wave-0 render regression for the 7
 * route-segment loading.tsx Suspense fallbacks (NATIVE-05, plan 07-05).
 *
 * Each loading.tsx is a PURE server file — no SDK, no 'use client', no params,
 * no async — that renders instantly while the heavy async RSC resolves. This
 * suite asserts each default export:
 *   1. mounts in RTL without throwing (render not.toThrow),
 *   2. paints at least one coral-soft pulse block (the shared Skeleton
 *      primitive: background var(--color-primary-soft) + `pulse` animation), and
 *   3. (source-level) imports no Telegram SDK and carries no 'use client'
 *      directive — they are pure presentational server components.
 *
 * Shape-echo fidelity (4 feed cards, stats hero+tiles+chart, …) is a visual
 * contract verified by eye / the UI-SPEC table; here we pin the load-bearing
 * invariant: the segment renders a pulse placeholder, never an empty frame.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import FeedLoading from '@/app/(mini)/feed/loading';
import StatsLoading from '@/app/(mini)/stats/loading';
import MyLoading from '@/app/(mini)/my/loading';
import StoreLoading from '@/app/(mini)/store/[id]/loading';
import PostLoading from '@/app/(mini)/post/[id]/loading';
import OrderLoading from '@/app/(mini)/order/[id]/loading';
import WaitLoading from '@/app/(mini)/wait/[id]/loading';

const root = fileURLToPath(new URL('../../', import.meta.url));

const SEGMENTS: ReadonlyArray<{
  name: string;
  Loading: () => React.ReactElement;
  src: string;
}> = [
  { name: 'feed', Loading: FeedLoading, src: 'app/(mini)/feed/loading.tsx' },
  { name: 'stats', Loading: StatsLoading, src: 'app/(mini)/stats/loading.tsx' },
  { name: 'my', Loading: MyLoading, src: 'app/(mini)/my/loading.tsx' },
  { name: 'store/[id]', Loading: StoreLoading, src: 'app/(mini)/store/[id]/loading.tsx' },
  { name: 'post/[id]', Loading: PostLoading, src: 'app/(mini)/post/[id]/loading.tsx' },
  { name: 'order/[id]', Loading: OrderLoading, src: 'app/(mini)/order/[id]/loading.tsx' },
  { name: 'wait/[id]', Loading: WaitLoading, src: 'app/(mini)/wait/[id]/loading.tsx' },
];

/** A pulse block = an element whose inline style uses the coral-soft fill or the
 *  `pulse` animation (the shared Skeleton primitive emits both). */
function pulseBlockCount(container: HTMLElement): number {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).filter((el) => {
    const style = el.getAttribute('style') ?? '';
    return /--color-primary-soft/.test(style) || /\bpulse\b/.test(style);
  }).length;
}

describe('route-segment loading skeletons (NATIVE-05)', () => {
  for (const { name, Loading, src } of SEGMENTS) {
    describe(name, () => {
      it('mounts without throwing', () => {
        expect(() => {
          const { unmount } = render(<Loading />);
          unmount();
        }).not.toThrow();
        cleanup();
      });

      it('paints at least one coral-soft pulse block', () => {
        const { container } = render(<Loading />);
        expect(pulseBlockCount(container)).toBeGreaterThanOrEqual(1);
        cleanup();
      });

      it('is a pure server file (no SDK import, no "use client")', () => {
        const source = readFileSync(root + src, 'utf8');
        expect(source).not.toMatch(/['"]use client['"]/);
        expect(source).not.toMatch(/@telegram-apps/);
        expect(source).not.toMatch(/useEffect|useState/);
      });
    });
  }
});
