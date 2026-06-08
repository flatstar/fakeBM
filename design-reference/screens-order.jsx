// screens-order.jsx — Home, Restaurant, Cart

// ─────────────────────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────────────────────
function HomeScreen({ stats, cartCount, onOpenRest, onOpenCart, goTab, catFilter, setCatFilter }) {
  const list = catFilter ? RESTAURANTS.filter(r => r.cat === catFilter) : RESTAURANTS;
  return (
    <Body style={{ background: 'var(--bg)' }}>
      {/* coral header */}
      <div style={{ background: 'var(--primary)', padding: '12px 16px 18px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: '#fff', font: '800 18px var(--font-display)', cursor: 'pointer', padding: 0, letterSpacing: .2, whiteSpace: 'nowrap' }}>
            우리집 <Icon name="chevDown" size={18} stroke={2.6} />
          </button>
          <button onClick={onOpenCart} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer', position: 'relative', padding: 4 }}>
            <Icon name="bag" size={26} stroke={2.2} />
            {cartCount > 0 && <span style={{ position: 'absolute', top: -2, right: -3, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#fff', color: 'var(--primary)', font: '800 11px var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', borderRadius: 14, padding: '13px 14px', boxShadow: '0 6px 16px rgba(180,60,30,.18)' }}>
          <Icon name="search" size={20} color="var(--ink3)" stroke={2.4} />
          <span style={{ font: '600 15px var(--font-body)', color: 'var(--ink3)', whiteSpace: 'nowrap' }}>오늘은 뭘 참아볼까? 🤤</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {/* willpower hero */}
        <Card onClick={() => goTab('stats')} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, background: 'linear-gradient(120deg,#231a14,#3a2a1d)', boxShadow: '0 12px 28px -10px rgba(40,20,8,.5)' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>🔥</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '500 12.5px var(--font-body)', color: 'rgba(255,255,255,.62)' }}>{stats.streak}일째 참는 중 · 이번 달</div>
            <div style={{ font: '800 24px var(--font-chunky)', color: '#fff', letterSpacing: .3, fontVariantNumeric: 'tabular-nums' }}>{fmtWon(stats.savedMonth)} <span style={{ font: '500 13px var(--font-body)', color: 'rgba(255,255,255,.6)' }}>아꼈어요</span></div>
          </div>
          <Icon name="chevron" size={20} color="rgba(255,255,255,.5)" />
        </Card>

        {/* quick tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { t: '오늘의 유혹', s: '랜덤 추천', e: '🎰', cb: () => onOpenRest(RESTAURANTS[Math.floor(Math.random() * RESTAURANTS.length)]) },
            { t: '명예의 전당', s: '참은 사람들', e: '🏆', cb: () => goTab('feed') },
            { t: '내 통계', s: '아낀 기록', e: '📊', cb: () => goTab('stats') },
          ].map(x => (
            <Card key={x.t} onClick={x.cb} style={{ padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{x.e}</div>
              <div style={{ font: '800 13.5px var(--font-display)', color: 'var(--ink)' }}>{x.t}</div>
              <div style={{ font: '500 11px var(--font-body)', color: 'var(--ink3)', marginTop: 1 }}>{x.s}</div>
            </Card>
          ))}
        </div>

        {/* categories */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ font: '800 17px var(--font-display)', color: 'var(--ink)' }}>뭐가 당기세요?</div>
          {catFilter && <button onClick={() => setCatFilter(null)} style={{ border: 'none', background: 'var(--primary-soft)', color: 'var(--primary)', font: '700 12px var(--font-body)', padding: '5px 11px', borderRadius: 999, cursor: 'pointer' }}>전체보기 ✕</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '14px 4px', marginBottom: 22 }}>
          {CATEGORIES.map(c => {
            const on = catFilter === c.key;
            return (
              <button key={c.key} onClick={() => setCatFilter(on ? null : c.key)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 0 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: on ? 'var(--primary)' : 'var(--surface)', boxShadow: on ? '0 6px 14px -4px rgba(255,90,51,.6)' : 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, transition: 'all .15s' }}>{c.emoji}</div>
                <span style={{ font: '600 11.5px var(--font-body)', color: on ? 'var(--primary)' : 'var(--ink2)', whiteSpace: 'nowrap' }}>{c.key}</span>
              </button>
            );
          })}
        </div>

        {/* restaurant list */}
        <div style={{ font: '800 17px var(--font-display)', color: 'var(--ink)', marginBottom: 12 }}>
          {catFilter ? `${catFilter} 가게` : '지금 제일 끌리는 가게'} <span style={{ font: '500 13px var(--font-body)', color: 'var(--ink3)' }}>{list.length}곳</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
          {list.map(r => <RestRow key={r.id} r={r} onClick={() => onOpenRest(r)} />)}
          {list.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ink3)', font: '600 14px var(--font-body)', padding: 30 }}>이 카테고리는 곧 추가돼요 🙏</div>}
        </div>
      </div>
    </Body>
  );
}

function RestRow({ r, onClick }) {
  return (
    <Card onClick={onClick} style={{ padding: 12, display: 'flex', gap: 13, alignItems: 'center' }}>
      <FoodTile emoji={r.emoji} cat={r.cat} radius={16} style={{ width: 76, height: 76, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '800 16px var(--font-display)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {r.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '4px 0 6px', font: '600 12.5px var(--font-body)', color: 'var(--ink2)' }}>
          <Icon name="star" size={14} color="var(--amber)" fill="solid" stroke={0} /> <b style={{ color: 'var(--ink)' }}>{r.rating}</b>
          <span style={{ color: 'var(--ink3)' }}>({fmtNum(r.reviews)})</span>
          <span style={{ color: 'var(--line)' }}>·</span>
          <Icon name="clock" size={13} color="var(--ink3)" /> {r.eta}
        </div>
        <div style={{ font: '500 12px var(--font-body)', color: 'var(--primary)', background: 'var(--primary-soft)', display: 'inline-block', padding: '3px 9px', borderRadius: 999 }}>“{r.tag}”</div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// RESTAURANT
// ─────────────────────────────────────────────────────────────
function RestaurantScreen({ r, cart, addItem, removeItem, onBack, onOpenCart }) {
  const count = Object.values(cart.items).reduce((a, b) => a + b, 0);
  const total = Object.entries(cart.items).reduce((a, [id, q]) => a + ALL_MENU[id].price * q, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <SubBar title={r.name} onBack={onBack} />
      <Body>
        <FoodTile emoji={r.emoji} cat={r.cat} radius={0} big style={{ width: '100%', height: 168 }} />
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ font: '800 22px var(--font-display)', color: 'var(--ink)' }}>{r.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0', font: '600 13px var(--font-body)', color: 'var(--ink2)' }}>
            <Icon name="star" size={15} color="var(--amber)" fill="solid" stroke={0} /> <b style={{ color: 'var(--ink)' }}>{r.rating}</b>
            <span style={{ color: 'var(--ink3)' }}>리뷰 {fmtNum(r.reviews)}</span>
            <span style={{ color: 'var(--line)' }}>·</span>
            <Icon name="clock" size={14} color="var(--ink3)" /> {r.eta}
            <span style={{ color: 'var(--line)' }}>·</span> 배달팁 {fmtWon(r.delivery)}
          </div>
          <div style={{ background: '#231a14', color: '#fff', borderRadius: 14, padding: '12px 14px', font: '600 13px var(--font-body)', display: 'flex', alignItems: 'center', gap: 9, margin: '6px 0 18px' }}>
            <span style={{ fontSize: 18 }}>✋</span> 여기서 시키면… 결제는 0원, 절제력은 +1. 담아두고 참아보세요.
          </div>

          <div style={{ font: '800 16px var(--font-display)', color: 'var(--ink)', marginBottom: 4 }}>메뉴</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {r.menu.map(m => {
              const q = cart.items[m.id] || 0;
              return (
                <div key={m.id} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                  <FoodTile emoji={m.emoji} cat={r.cat} radius={14} style={{ width: 64, height: 64, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 15px var(--font-body)', color: 'var(--ink)' }}>{m.name}</div>
                    {m.desc && <div style={{ font: '500 12px var(--font-body)', color: 'var(--ink3)', margin: '2px 0' }}>{m.desc}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{ font: '800 15px var(--font-body)', color: 'var(--ink)' }}>{fmtWon(m.price)}</span>
                      <span style={{ font: '600 11.5px var(--font-body)', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '2px 7px', borderRadius: 999 }}>🔥 {fmtNum(m.kcal)}kcal</span>
                    </div>
                  </div>
                  {q === 0 ? (
                    <button onClick={() => addItem(r, m.id)} style={{ width: 34, height: 34, borderRadius: 11, border: '1.5px solid var(--primary)', background: 'var(--surface)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <Icon name="plus" size={18} stroke={2.6} />
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => removeItem(m.id)} style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="minus" size={16} stroke={2.6} /></button>
                      <span style={{ font: '800 15px var(--font-body)', minWidth: 18, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{q}</span>
                      <button onClick={() => addItem(r, m.id)} style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="plus" size={16} stroke={2.6} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ height: 12 }} />
        </div>
      </Body>
      {count > 0 && <TgMainButton label={`장바구니 보기`} sub={`${count}개 담음 · ${fmtWon(total)} 아끼는 중`} icon="bag" onClick={onOpenCart} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CART
// ─────────────────────────────────────────────────────────────
function CartScreen({ cart, addItem, removeItem, onBack, onOrder }) {
  const rest = RESTAURANTS.find(r => r.id === cart.restId);
  const entries = Object.entries(cart.items);
  const subtotal = entries.reduce((a, [id, q]) => a + ALL_MENU[id].price * q, 0);
  const tip = rest ? rest.delivery : 0;
  const total = subtotal + tip;
  const kcal = entries.reduce((a, [id, q]) => a + ALL_MENU[id].kcal * q, 0);
  if (!rest || entries.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
        <SubBar title="장바구니" onBack={onBack} />
        <Body style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--ink3)' }}>
          <div style={{ fontSize: 48 }}>🛒</div>
          <div style={{ font: '700 16px var(--font-display)', color: 'var(--ink2)' }}>아직 담은 유혹이 없어요</div>
          <div style={{ font: '500 13px var(--font-body)' }}>먹고 싶은 걸 담고, 결제 직전에 참아보세요</div>
        </Body>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <SubBar title="장바구니" onBack={onBack} />
      <Body style={{ padding: '14px 16px 0' }}>
        <div style={{ font: '800 16px var(--font-display)', color: 'var(--ink)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
          <FoodTile emoji={rest.emoji} cat={rest.cat} radius={9} style={{ width: 30, height: 30 }} /> {rest.name}
        </div>
        <Card style={{ padding: '4px 14px', marginBottom: 14 }}>
          {entries.map(([id, q], i) => {
            const m = ALL_MENU[id];
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 24 }}>{m.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 14.5px var(--font-body)', color: 'var(--ink)' }}>{m.name}</div>
                  <div style={{ font: '600 12.5px var(--font-body)', color: 'var(--ink2)' }}>{fmtWon(m.price)} · 🔥{fmtNum(m.kcal)}kcal</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => removeItem(id)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="minus" size={15} stroke={2.6} /></button>
                  <span style={{ font: '800 14px var(--font-body)', minWidth: 16, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{q}</span>
                  <button onClick={() => addItem(rest, id)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="plus" size={15} stroke={2.6} /></button>
                </div>
              </div>
            );
          })}
        </Card>

        <Card style={{ padding: 16, marginBottom: 14 }}>
          {[['메뉴 합계', fmtWon(subtotal)], ['배달팁', fmtWon(tip)]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', font: '600 13.5px var(--font-body)', color: 'var(--ink2)', marginBottom: 8 }}><span style={{ whiteSpace: 'nowrap' }}>{k}</span><span>{v}</span></div>
          ))}
          <div style={{ borderTop: '1px dashed var(--line)', margin: '4px 0 10px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ font: '700 14px var(--font-body)', color: 'var(--ink2)', whiteSpace: 'nowrap' }}>원래 낼 돈</span>
            <span style={{ font: '800 17px var(--font-body)', color: 'var(--ink3)', textDecoration: 'line-through' }}>{fmtWon(total)}</span>
          </div>
        </Card>

        {/* the payoff */}
        <Card style={{ padding: 18, marginBottom: 8, background: 'var(--green-soft)', boxShadow: 'none', border: '1.5px solid #BBE6C9' }}>
          <div style={{ font: '700 13px var(--font-body)', color: 'var(--green)', marginBottom: 10 }}>지금 참으면 ✨</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 26px var(--font-chunky)', color: 'var(--green)', letterSpacing: .3, fontVariantNumeric: 'tabular-nums' }}>+{fmtWon(total)}</div>
              <div style={{ font: '600 12px var(--font-body)', color: 'var(--green)' }}>아끼는 돈</div>
            </div>
            <div style={{ width: 1, background: '#BBE6C9' }} />
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 26px var(--font-chunky)', color: 'var(--primary)', letterSpacing: .3, fontVariantNumeric: 'tabular-nums' }}>−{fmtNum(kcal)}</div>
              <div style={{ font: '600 12px var(--font-body)', color: 'var(--primary)' }}>덜 먹는 kcal</div>
            </div>
          </div>
        </Card>
      </Body>
      <TgMainButton label="주문하고 참기" sub="도착할 때까지 버텨봐요!" icon="rider" onClick={() => onOrder(total, kcal)} />
    </div>
  );
}

Object.assign(window, { HomeScreen, RestaurantScreen, CartScreen });
