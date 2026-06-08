/**
 * app/(boot)/page.tsx — the PUBLIC bootstrap surface served at `/` (AUTH-01/04/05).
 *
 * This is NOT behind the (mini) guard and is excluded from the proxy matcher
 * (the `$` alternative), so it is also the `/?reauth=1` re-auth landing — a
 * cookieless first-open user reaches it instead of looping (threat T-01-BOOT).
 *
 * It renders a minimal coral splash and mounts the SessionBoot client leaf,
 * which runs the SDK boot, POSTs /api/session to establish the cookie, then
 * forwards into the protected /home. The protected home shell lives at /home
 * (app/(mini)/home/page.tsx, built in plan 03) — NOT here.
 */
import SessionBoot from './_components/SessionBoot';

export default function BootPage() {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: 'var(--color-bg)',
        color: 'var(--color-primary)',
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 700 }}>여는 중…</span>
      <SessionBoot />
    </main>
  );
}
