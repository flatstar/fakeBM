/**
 * components/BottomNav.tsx — 5-slot bottom nav with the center 참기 FAB (ported
 * from design-reference/app.jsx BottomNav, lines 147–166). Slots 홈/피드/[FAB]/
 * 통계/MY; active = coral, inactive = --ink3; label 10.5/700 active vs 500 inactive.
 *
 * The prototype's `tab` state machine is converted to Next.js route-based active
 * detection via usePathname (the order-flow `view` stack is Phase 2+ and is NOT
 * ported here).
 *
 * 참기 FAB: 58×58 coral circle, 4px --surface border, top:-26 offset, FAB shadow,
 * ✋ (U+270B) glyph + "참기" — NEVER the U+1FAF7 leftwards-pushing-hand
 * (Pitfall 6 / UI-SPEC emoji whitelist).
 */
'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

interface NavSlot {
  href: string;
  icon: IconName;
  label: string;
}

const SLOTS: readonly (NavSlot | null)[] = [
  { href: '/home', icon: 'home', label: '홈' },
  { href: '/feed', icon: 'feed', label: '피드' },
  null, // center 참기 FAB
  { href: '/stats', icon: 'chart', label: '통계' },
  { href: '/my', icon: 'user', label: 'MY' },
];

export interface BottomNavProps {
  /** Optional center-FAB handler (the 참기 order flow lands in Phase 2). */
  onCenter?: () => void;
}

export function BottomNav({ onCenter }: BottomNavProps): ReactElement {
  const pathname = usePathname();
  return (
    <nav
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        padding: '8px 8px calc(22px + var(--safe-b))',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-line)',
        position: 'relative',
        zIndex: 20,
      }}
    >
      {SLOTS.map((slot, idx) => {
        if (slot === null) {
          return (
            <div key="center" style={{ width: 56, position: 'relative' }}>
              <button
                type="button"
                onClick={onCenter}
                aria-label="참기"
                style={{
                  position: 'absolute',
                  top: -26,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  border: '4px solid var(--color-surface)',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 18px -4px rgba(255,90,51,.6)',
                  gap: 1,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>✋</span>
                <span style={{ font: '800 10px var(--font-body)', wordBreak: 'keep-all' }}>참기</span>
              </button>
            </div>
          );
        }
        const active = pathname === slot.href || pathname.startsWith(slot.href + '/');
        return (
          <Link
            key={slot.href}
            href={slot.href}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              color: active ? 'var(--color-primary)' : 'var(--color-ink3)',
              padding: '2px 0',
            }}
          >
            <Icon name={slot.icon} size={24} stroke={2.2} />
            <span
              style={{
                font: active ? '700 10.5px var(--font-body)' : '500 10.5px var(--font-body)',
                wordBreak: 'keep-all',
              }}
            >
              {slot.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
