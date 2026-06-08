/**
 * app/(mini)/home/page.tsx — the /home route (D-10 payoff surface). Forward
 * target of the public (boot) SessionBoot: an authenticated user lands here.
 *
 * Phase 2 makes /home interactive (ORDER-01/02, D-10): the SSR page is now a thin
 * shell that mounts the `'use client'` HomeClient (coral header + live search +
 * willpower hero + category grid + filtered restaurant list) inside the standard
 * <Body> scroll area, plus the one-time WelcomeIntro overlay.
 *
 * Money HARD RULE (Pitfall 7) is enforced inside HomeClient/RestRow via the
 * <Won>/<Num> wrappers — no number is ever routed through a BM display font.
 */
import type { ReactElement } from 'react';
import { Body } from '@/components/Body';
import { WelcomeIntro } from '../_components/WelcomeIntro';
import { HomeClient } from './_components/HomeClient';

export default function HomePage(): ReactElement {
  return (
    <>
      <Body style={{ background: 'var(--color-bg)' }}>
        <HomeClient />
      </Body>

      {/* One-time first-visit intro overlay (D-08/09). */}
      <WelcomeIntro />
    </>
  );
}
