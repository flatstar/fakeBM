/**
 * app/share/page.tsx — PUBLIC boundary stub (AUTH-05).
 *
 * Renders with NO session: it is excluded from the proxy matcher and lives
 * outside the (mini) guard, so unauthenticated visitors (e.g. a shared link
 * recipient) can open it. Populated with real share content in Phase 6.
 */
export default function SharePage() {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-ink)',
      }}
    >
      <h1>공유</h1>
    </main>
  );
}
