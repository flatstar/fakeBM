// app.jsx — 배달의 만족 shell: nav, order-flow stack, stats, tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primaryColor": "#FF5A33",
  "displayFont": "한나",
  "waitSeconds": 13
}/*EDITMODE-END*/;

const FONT_MAP = { '한나': "'BMHanna','Pretendard',sans-serif", '도현': "'BMDohyeon','Pretendard',sans-serif", '주아': "'BMJua','Pretendard',sans-serif" };

const BASE = { savedMonth: 86000, savedTotal: 242000, kcalTotal: 14200, resisted: 18, streak: 7 };
const SEED_BYDAY = [12000, 0, 21000, 14500, 0, 30000, 9000];

function computeStats(posts) {
  const mine = posts.filter(p => p.userCreated);
  const addSaved = mine.reduce((a, p) => a + p.saved, 0);
  const addKcal = mine.reduce((a, p) => a + p.kcal, 0);
  const byDay = [...SEED_BYDAY];
  mine.forEach(p => { byDay[6] += p.saved; });
  // most-resisted category across all posts
  const counts = {};
  posts.forEach(p => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  const topCat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '치킨';
  return {
    savedMonth: BASE.savedMonth + addSaved,
    savedTotal: BASE.savedTotal + addSaved,
    kcalTotal: BASE.kcalTotal + addKcal,
    resisted: BASE.resisted + mine.length,
    streak: BASE.streak + mine.length,
    byDay, topCat,
  };
}

function nowStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = React.useState('home');         // home | feed | stats | my
  const [view, setView] = React.useState(null);          // null | rest | cart | delivery | post
  const [rest, setRest] = React.useState(null);
  const [cart, setCart] = React.useState({ restId: null, items: {} });
  const [order, setOrder] = React.useState(null);
  const [posts, setPosts] = React.useState(SEED_POSTS);
  const [catFilter, setCatFilter] = React.useState(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [burst, setBurst] = React.useState(false);

  const stats = React.useMemo(() => computeStats(posts), [posts]);
  const cartCount = Object.values(cart.items).reduce((a, b) => a + b, 0);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1900); };

  const openRest = (r) => {
    setRest(r);
    if (cart.restId !== r.id) setCart({ restId: r.id, items: {} });
    setView('rest');
  };
  const addItem = (r, id) => {
    setCart(c => (c.restId === r.id ? { ...c, items: { ...c.items, [id]: (c.items[id] || 0) + 1 } } : { restId: r.id, items: { [id]: 1 } }));
  };
  const removeItem = (id) => setCart(c => {
    const n = (c.items[id] || 0) - 1, items = { ...c.items };
    if (n <= 0) delete items[id]; else items[id] = n;
    return { ...c, items };
  });
  const placeOrder = (total, kcal) => {
    setOrder({ restId: cart.restId, items: { ...cart.items }, total, kcal, orderNo: 'No.' + Math.floor(1000000 + Math.random() * 9000000), time: nowStr() });
    setCart({ restId: null, items: {} });
    setView('delivery');
  };
  const publishPost = ({ caption, diet }) => {
    const r = RESTAURANTS.find(x => x.id === order.restId);
    const items = Object.keys(order.items).map(id => ALL_MENU[id].name);
    const np = {
      id: 'u' + Date.now(), user: '나', day: stats.streak + 1, time: '방금 전',
      rest: r.name, items, cat: r.cat, emoji: r.emoji,
      saved: order.total, kcal: order.kcal, likes: 0, liked: false,
      caption, diet, userCreated: true, foodSlot: 'post_new_food', dietSlot: 'post_new_diet',
    };
    setPosts(p => [np, ...p]);
    setOrder(null); setView(null); setTab('feed');
    setBurst(true); setTimeout(() => setBurst(false), 1400);
    showToast('명예의 전당에 박제됐어요 🏆');
  };
  const toggleLike = (id) => setPosts(ps => ps.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p));
  const goTab = (x) => { setView(null); setShareOpen(false); setTab(x); };

  const inStack = view !== null;
  const headerTitle = view === 'rest' ? rest?.name : '배달의 만족';

  // ── render current screen ──
  let screen;
  if (inStack) {
    if (view === 'rest') screen = <RestaurantScreen r={rest} cart={cart} addItem={addItem} removeItem={removeItem} onBack={() => setView(null)} onOpenCart={() => setView('cart')} />;
    else if (view === 'cart') screen = <CartScreen cart={cart} addItem={addItem} removeItem={removeItem} onBack={() => setView('rest')} onOrder={placeOrder} />;
    else if (view === 'delivery') screen = <DeliveryScreen order={order} durationMs={t.waitSeconds * 1000} onArrive={() => setView('post')} onCancel={() => { setView(null); }} />;
    else if (view === 'post') screen = <PostScreen order={order} onPost={publishPost} onCancel={() => setView('delivery')} />;
  } else {
    if (tab === 'home') screen = <HomeScreen stats={stats} cartCount={cartCount} onOpenRest={openRest} onOpenCart={() => { cart.restId ? (setRest(RESTAURANTS.find(r => r.id === cart.restId)), setView('cart')) : showToast('장바구니가 비었어요 🛒'); }} goTab={goTab} catFilter={catFilter} setCatFilter={setCatFilter} />;
    else if (tab === 'feed') screen = <FeedScreen posts={posts} onLike={toggleLike} goOrder={() => goTab('home')} />;
    else if (tab === 'stats') screen = <StatsScreen stats={stats} onShare={() => setShareOpen(true)} />;
    else if (tab === 'my') screen = <MyScreen stats={stats} posts={posts} />;
  }

  const rootVars = {
    '--primary': t.primaryColor,
    '--primary-soft': `color-mix(in srgb, ${t.primaryColor} 13%, white)`,
    '--primary-ink': `color-mix(in srgb, ${t.primaryColor} 86%, black)`,
    '--font-display': FONT_MAP[t.displayFont],
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20, boxSizing: 'border-box' }}>
      <IOSDevice>
        <div style={{ ...rootVars, height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
          {/* status-bar safe area */}
          <div style={{ height: 54, flexShrink: 0, background: 'var(--tg-header)' }} />
          {!inStack && <TgHeader />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{screen}</div>
          {!inStack && <BottomNav tab={tab} setTab={goTab} onCenter={() => openRest(RESTAURANTS[Math.floor(Math.random() * RESTAURANTS.length)])} />}

          {shareOpen && <ShareCard stats={stats} onClose={() => setShareOpen(false)} onToast={showToast} />}
          <Burst show={burst} />
          {toast && <div style={{ position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)', background: 'rgba(35,26,20,.94)', color: '#fff', font: '700 13px var(--font-body)', padding: '11px 18px', borderRadius: 999, zIndex: 95, animation: 'fadeUp .25s ease', whiteSpace: 'nowrap' }}>{toast}</div>}

          {/* Tweaks */}
          <TweaksPanel>
            <TweakSection label="브랜드 컬러" />
            <TweakColor label="메인 색" value={t.primaryColor} options={['#FF5A33', '#13C5B8', '#E8392B', '#F5A524', '#7C5CD6']} onChange={v => setTweak('primaryColor', v)} />
            <TweakSection label="타이포" />
            <TweakRadio label="제목 글꼴" value={t.displayFont} options={['한나', '도현', '주아']} onChange={v => setTweak('displayFont', v)} />
            <TweakSection label="가짜 배달" />
            <TweakSlider label="대기 시간" value={t.waitSeconds} min={3} max={30} step={1} unit="초" onChange={v => setTweak('waitSeconds', v)} />
          </TweaksPanel>
        </div>
      </IOSDevice>
    </div>
  );
}

// ── bottom nav (5-slot with center FAB) ──
function BottomNav({ tab, setTab, onCenter }) {
  const items = [{ k: 'home', i: 'home', l: '홈' }, { k: 'feed', i: 'feed', l: '피드' }, null, { k: 'stats', i: 'chart', l: '통계' }, { k: 'my', i: 'user', l: 'MY' }];
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', padding: '8px 8px 22px', background: 'var(--surface)', borderTop: '1px solid var(--line)', position: 'relative', zIndex: 20 }}>
      {items.map((it, idx) => it === null ? (
        <div key="c" style={{ width: 56, position: 'relative' }}>
          <button onClick={onCenter} style={{ position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', width: 58, height: 58, borderRadius: '50%', border: '4px solid var(--surface)', background: 'var(--primary)', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 18px -4px rgba(255,90,51,.6)', gap: 1 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>✋</span>
            <span style={{ font: '800 10px var(--font-body)' }}>참기</span>
          </button>
        </div>
      ) : (
        <button key={it.k} onClick={() => setTab(it.k)} style={{ flex: 1, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: tab === it.k ? 'var(--primary)' : 'var(--ink3)', padding: '2px 0' }}>
          <Icon name={it.i} size={24} stroke={2.2} fill={tab === it.k && it.i === 'home' ? 'none' : 'none'} />
          <span style={{ font: tab === it.k ? '700 10.5px var(--font-body)' : '500 10.5px var(--font-body)' }}>{it.l}</span>
        </button>
      ))}
    </div>
  );
}

// ── MY (lightweight) ──
function MyScreen({ stats, posts }) {
  const mine = posts.filter(p => p.userCreated);
  return (
    <Body style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <Avatar name="나" size={62} />
          <div>
            <div style={{ font: '800 20px var(--font-display)', color: 'var(--ink)' }}>참는 중인 나</div>
            <div style={{ font: '600 13px var(--font-body)', color: 'var(--primary)' }}>🔥 {stats.streak}일 연속 · {mine.length}개 인증</div>
          </div>
        </div>
        <Card style={{ padding: 18, marginBottom: 16, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          {[[fmtWon(stats.savedTotal), '누적 절약'], [fmtNum(stats.kcalTotal), '덜 먹은 kcal'], [stats.resisted, '총 참은 횟수']].map(x => (
            <div key={x[1]}>
              <div style={{ font: '800 18px var(--font-chunky)', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{x[0]}</div>
              <div style={{ font: '600 11px var(--font-body)', color: 'var(--ink3)', marginTop: 3 }}>{x[1]}</div>
            </div>
          ))}
        </Card>
        <Card style={{ padding: '4px 0', marginBottom: 16 }}>
          {[['🧾', '내 인증 기록'], ['🔔', '참기 알림 설정'], ['👯', '친구 초대'], ['❔', '도움말']].map((x, i, a) => (
            <div key={x[1]} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontSize: 19 }}>{x[0]}</span>
              <span style={{ flex: 1, font: '600 14.5px var(--font-body)', color: 'var(--ink)' }}>{x[1]}</span>
              <Icon name="chevron" size={18} color="var(--ink3)" />
            </div>
          ))}
        </Card>
        <div style={{ textAlign: 'center', font: '500 11.5px var(--font-body)', color: 'var(--ink3)', paddingBottom: 20 }}>배달의 만족 · 시켜놓고, 참는다</div>
      </div>
    </Body>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
