/**
 * app/share/[id]/page.tsx — the PUBLIC share-card page (S3, SHARE-03).
 *
 * Reachable by anyone with the opaque link, with NO session — it lives outside
 * the `(mini)` guard and the proxy matcher already excludes `share` (D-08). It
 * therefore does NOT call requireSession / redirect: copying the (mini) guard
 * here would defeat the entire feature (a shared link must open in any browser,
 * outside Telegram). The page renders NO Telegram shell (no TgHeader, no
 * BottomNav) — it is a standalone web document.
 *
 * It renders the FROZEN snapshot (D-01) via the shared DOM <ShareCard> (same
 * component the S2 sheet uses, so the surfaces stay identical). An unknown id →
 * notFound() (404, no data leak, no existence oracle — T-06-01).
 *
 * generateMetadata emits og:image (+ title) so crawlers (인스타/카톡/Twitter)
 * render a preview. The colocated opengraph-image.tsx also auto-emits og:image;
 * setting it explicitly is belt-and-braces and lets a Blob-cached ogUrl win.
 *
 * Next 16: params is a Promise — it is awaited (RESEARCH Pitfall 3).
 */
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { ShareCard } from '@/components/ShareCard';
import { getShare } from '@/lib/share';

type Params = { params: Promise<{ id: string }> };

export const viewport: Viewport = {
  themeColor: '#2a1d14',
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) return {}; // page() will notFound()

  const ogImage = share.ogUrl ?? `/share/${id}/opengraph-image`;
  return {
    title: '배달의 만족 · 참아서 만든 기록',
    openGraph: {
      title: '배달의 만족 리포트',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: '배달의 만족 리포트',
      images: [ogImage],
    },
  };
}

export default async function SharePage({ params }: Params) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) notFound();

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <ShareCard {...share} />
      </div>
    </main>
  );
}
