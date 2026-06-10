// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TgHeader } from '@/components/TgHeader';
import { BottomNav } from '@/components/BottomNav';
import { CartProvider } from '@/lib/cart';
import HomePage from '@/app/(mini)/home/page';

// BottomNav uses next/navigation usePathname for route-based active state; pin a
// stable route so the home tab is active in the offline render. The FAB default
// (NATIVE-02) also reads useRouter().push, so provide a push spy.
vi.mock('next/navigation', () => ({
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// WelcomeIntro now reads the native MainButton availability signal (NATIVE-04);
// outside Telegram it must be a no-op so the DOM fallback renders. Mock the SDK
// fns as unavailable SafeWrapped stubs.
vi.mock('@telegram-apps/sdk-react', () => {
  const unavailable = Object.assign(() => {}, {
    isAvailable: () => false,
    ifAvailable: () => [false] as const,
  });
  return {
    mountMainButton: unavailable,
    setMainButtonParams: unavailable,
    onMainButtonClick: unavailable,
    isMainButtonMounted: () => false,
    showBackButton: unavailable,
    hideBackButton: unavailable,
    onBackButtonClick: unavailable,
    hapticFeedbackImpactOccurred: unavailable,
    hapticFeedbackNotificationOccurred: unavailable,
    hapticFeedbackSelectionChanged: unavailable,
  };
});

// jsdom's localStorage is not reliably writable across vitest/jsdom versions;
// install a minimal in-memory polyfill so the welcome first-visit flag (D-09)
// can be pre-set deterministically.
function installLocalStorage() {
  const store = new Map<string, string>();
  const mock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: mock,
  });
}

/**
 * Mirrors the authenticated (mini)/layout.tsx shell composition (CartProvider +
 * TgHeader + HomePage + BottomNav) without the async requireSession() guard,
 * which is an RSC server boundary covered by the plan-02 auth suite. The
 * CartProvider wrap matches the real layout (Phase 2: HomeClient consumes
 * useCart for the cart badge). This is the offline D-10 payoff smoke: header
 * title + search pill + ✋ FAB all present.
 */
function HomeShell() {
  return (
    <CartProvider>
      <div>
        <TgHeader title="배달의 만족" />
        <HomePage />
        <BottomNav />
      </div>
    </CartProvider>
  );
}

describe('home shell (D-10 payoff surface)', () => {
  beforeEach(() => {
    installLocalStorage();
    // Pre-set the welcome first-visit flag so the one-time intro is dismissed and
    // the home shell is the thing under test.
    localStorage.setItem('manjok:welcome-seen', '1');
  });

  it('renders the TG header title', () => {
    render(<HomeShell />);
    expect(screen.getByText('배달의 만족')).toBeDefined();
  });

  it('renders the live search pill (placeholder on the search input)', () => {
    render(<HomeShell />);
    // Phase 2 converts the static span to a live search input (D-10); the
    // copy is preserved as the placeholder.
    expect(screen.getByPlaceholderText('오늘은 뭘 참아볼까? 🤤')).toBeDefined();
  });

  it('renders the willpower hero amount through the Pretendard money wrapper', () => {
    render(<HomeShell />);
    expect(screen.getByText('₩86,000')).toBeDefined();
  });

  it('renders the bottom-nav 참기 FAB with the ✋ (U+270B) glyph', () => {
    render(<HomeShell />);
    const fab = screen.getByRole('button', { name: '참기' });
    expect(fab.textContent).toContain('✋');
    expect(fab.textContent).not.toContain('\u{1FAF7}'); // never 🫷
  });

  it('does not show the welcome intro once the first-visit flag is set', () => {
    render(<HomeShell />);
    expect(screen.queryByRole('dialog', { name: '환영 인트로' })).toBeNull();
  });
});
