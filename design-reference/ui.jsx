// ui.jsx — 배달의 만족 shared UI primitives (Telegram Mini App styled)

// Telegram Mini App header chrome (sits under iOS status bar)
function TgHeader({ title = '배달의 만족', showBack = false, onBack }) {
  return (
    <div style={{
      height: 50, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 8px 0 6px', background: 'var(--tg-header)',
      borderBottom: '1px solid var(--tg-header-line)', position: 'relative', zIndex: 30,
    }}>
      <div style={{ width: 76, display: 'flex', alignItems: 'center' }}>
        {showBack && (
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 2, border: 'none', background: 'none',
            color: 'var(--tg-link)', font: '600 15px var(--font-body)', cursor: 'pointer', padding: '6px 6px',
          }}>
            <Icon name="back" size={20} stroke={2.4} /> 뒤로
          </button>
        )}
      </div>
      <div style={{
        flex: 1, textAlign: 'center', font: '700 16px var(--font-body)', color: 'var(--tg-title)',
        display: 'flex', flexDirection: 'column', lineHeight: 1.1,
      }}>
        <span>{title}</span>
        <span style={{ font: '400 11px var(--font-body)', color: 'var(--tg-sub)', marginTop: 1 }}>mini app · bot</span>
      </div>
      <div style={{ width: 76, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, color: 'var(--tg-icon)' }}>
        <span style={{ display: 'flex', padding: 7 }}><Icon name="chevDown" size={18} stroke={2.2} /></span>
        <span style={{ display: 'flex', padding: 7 }}><Icon name="x" size={18} stroke={2.2} /></span>
      </div>
    </div>
  );
}

// Telegram-style pinned main button
function TgMainButton({ label, sub, onClick, disabled = false, color = 'var(--primary)', icon }) {
  return (
    <div style={{ padding: '10px 14px calc(14px + env(safe-area-inset-bottom))', flexShrink: 0, background: 'linear-gradient(to top, var(--bg) 62%, transparent)' }}>
      <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
        width: '100%', border: 'none', borderRadius: 16, cursor: disabled ? 'default' : 'pointer',
        background: disabled ? '#E3D8CE' : color, color: '#fff',
        padding: sub ? '11px 18px' : '16px 18px', minHeight: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        boxShadow: disabled ? 'none' : '0 8px 20px -6px ' + 'rgba(255,90,51,.5)',
        transition: 'transform .12s, filter .12s', WebkitTapHighlightColor: 'transparent',
      }}
        onPointerDown={e => !disabled && (e.currentTarget.style.transform = 'scale(.98)')}
        onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {icon && <Icon name={icon} size={22} stroke={2.4} />}
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ font: '800 17px var(--font-display)', letterSpacing: .2 }}>{label}</span>
          {sub && <span style={{ font: '500 12px var(--font-body)', opacity: .92 }}>{sub}</span>}
        </span>
      </button>
    </div>
  );
}

// scrollable screen body
function Body({ children, style }) {
  return (
    <div className="app-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', ...style }}>
      {children}
    </div>
  );
}

// in-screen back/title bar (coral) used on subpages
function SubBar({ title, onBack, right }) {
  return (
    <div style={{
      height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px',
      background: 'var(--surface)', borderBottom: '1px solid var(--line)', zIndex: 12,
    }}>
      <button onClick={onBack} style={{ border: 'none', background: 'none', padding: 9, display: 'flex', cursor: 'pointer', color: 'var(--ink)' }}>
        <Icon name="back" size={24} stroke={2.4} />
      </button>
      <div style={{ flex: 1, font: '800 18px var(--font-display)', color: 'var(--ink)', letterSpacing: .2 }}>{title}</div>
      {right}
    </div>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', borderRadius: 18, boxShadow: 'var(--shadow)',
      cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
}

// little stat pill with icon
function StatBadge({ icon, label, value, tint }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px 5px 8px', borderRadius: 999,
      background: tint.soft, color: tint.fg, font: '700 12.5px var(--font-body)',
    }}>
      <Icon name={icon} size={15} stroke={2.4} />
      <span>{label}<b style={{ font: '800 13px var(--font-body)', marginLeft: 2 }}>{value}</b></span>
    </div>
  );
}

const TINT = {
  save: { soft: 'var(--green-soft)', fg: 'var(--green)' },
  kcal: { soft: 'var(--primary-soft)', fg: 'var(--primary-ink)' },
  streak: { soft: 'var(--amber-soft)', fg: 'var(--amber-ink)' },
};

// confetti burst (canvas-free, simple DOM)
function Burst({ show }) {
  if (!show) return null;
  const bits = Array.from({ length: 26 });
  const colors = ['#FF5A33', '#FFB454', '#16A34A', '#7AA7E0', '#F59E0B', '#E08BA9'];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 80 }}>
      {bits.map((_, i) => {
        const x = Math.random() * 100, d = 0.6 + Math.random() * 0.7, delay = Math.random() * 0.15;
        const c = colors[i % colors.length], rot = Math.random() * 360;
        return <span key={i} style={{
          position: 'absolute', top: '38%', left: x + '%', width: 8, height: 12, background: c, borderRadius: 2,
          transform: `rotate(${rot}deg)`, animation: `confFall ${d}s ${delay}s ease-in forwards`, opacity: 0,
        }} />;
      })}
    </div>
  );
}

Object.assign(window, { TgHeader, TgMainButton, Body, SubBar, Card, StatBadge, TINT, Burst });
