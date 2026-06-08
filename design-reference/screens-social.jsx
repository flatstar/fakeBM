// screens-social.jsx — Feed, Stats dashboard, Share card

// ─────────────────────────────────────────────────────────────
// FEED  (명예의 전당)
// ─────────────────────────────────────────────────────────────
function FeedScreen({ posts, onLike, goOrder }) {
  return (
    <Body style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '16px 16px 4px' }}>
        <div style={{ font: '800 24px var(--font-chunky)', color: 'var(--ink)', letterSpacing: .3 }}>명예의 전당 🏆</div>
        <div style={{ font: '600 13px var(--font-body)', color: 'var(--ink2)', marginTop: 2 }}>오늘도 시켜놓고 참아낸 사람들</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 16px 16px' }}>
        {posts.map(p => <PostCard key={p.id} p={p} onLike={onLike} />)}
        <button onClick={goOrder} style={{ border: '1.5px dashed var(--primary)', background: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: 16, padding: 16, font: '700 14px var(--font-display)', cursor: 'pointer' }}>
          + 나도 참고 인증하기
        </button>
      </div>
    </Body>
  );
}

function PostCard({ p, onLike }) {
  return (
    <Card style={{ padding: 14, overflow: 'hidden' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar name={p.user} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '800 14.5px var(--font-display)', color: 'var(--ink)' }}>{p.user}</div>
          <div style={{ font: '500 11.5px var(--font-body)', color: 'var(--ink3)' }}>{p.time} · 인증</div>
        </div>
        <div style={{ font: '700 11.5px var(--font-body)', color: 'var(--amber-ink)', background: 'var(--amber-soft)', padding: '4px 10px', borderRadius: 999 }}>🔥 {p.day}일째</div>
      </div>

      {/* dual photo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <PostPhoto post={p} side="food" />
        <PostPhoto post={p} side="diet" />
      </div>

      {/* receipt chip + payoff */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: '600 12px var(--font-body)', color: 'var(--ink2)', marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg)', padding: '5px 10px', borderRadius: 999 }}>
          <Icon name="receipt" size={14} color="var(--ink3)" /> {p.rest} · {p.items.join(', ')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
        <StatBadge icon="won" label="아낌 " value={fmtWon(p.saved)} tint={TINT.save} />
        <StatBadge icon="fire" label="−" value={fmtNum(p.kcal) + 'kcal'} tint={TINT.kcal} />
      </div>

      {/* caption + diet */}
      <div style={{ font: '500 13.5px var(--font-body)', color: 'var(--ink)', lineHeight: 1.55, marginBottom: 8 }}>{p.caption}</div>
      <div style={{ font: '600 12px var(--font-body)', color: 'var(--green)', background: 'var(--green-soft)', padding: '8px 11px', borderRadius: 10, marginBottom: 12, display: 'flex', gap: 6 }}>
        <span>🥗</span><span>{p.diet}</span>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, borderTop: '1px solid var(--line)', paddingTop: 11 }}>
        <button onClick={() => onLike(p.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, color: p.liked ? 'var(--primary)' : 'var(--ink2)', font: '700 13px var(--font-body)' }}>
          <Icon name="heart" size={20} stroke={2.2} fill={p.liked ? 'var(--primary)' : 'none'} color={p.liked ? 'var(--primary)' : 'var(--ink2)'} /> {fmtNum(p.likes)}
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink2)', font: '700 13px var(--font-body)' }}><Icon name="chat" size={19} stroke={2.2} /> 응원</span>
        <div style={{ flex: 1 }} />
        <Icon name="bookmark" size={19} color="var(--ink3)" stroke={2.2} />
      </div>
    </Card>
  );
}

function PostPhoto({ post, side }) {
  const isFood = side === 'food';
  const label = isFood ? '시킨 척 🤤' : '실제 식단 🥗';
  const tag = (
    <div style={{ position: 'absolute', bottom: 7, left: 7, font: '700 10.5px var(--font-body)', color: '#fff', background: 'rgba(35,26,20,.7)', padding: '3px 8px', borderRadius: 999, zIndex: 2 }}>{label}</div>
  );
  if (post.userCreated) {
    return (
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
        <image-slot id={isFood ? post.foodSlot : post.dietSlot} shape="rounded" radius="14" placeholder={isFood ? '음식 사진' : '식단 사진'} style={{ width: '100%', height: 128, display: 'block' }}></image-slot>
        {tag}
      </div>
    );
  }
  // seed fallback "photos"
  return (
    <div style={{ position: 'relative', height: 128, borderRadius: 14, overflow: 'hidden' }}>
      {isFood
        ? <FoodTile emoji={post.emoji} cat={post.cat} radius={14} big style={{ width: '100%', height: '100%' }} />
        : <div style={{ width: '100%', height: '100%', background: 'radial-gradient(120% 120% at 30% 20%,#D8F0DE,#9FD8AE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>🥗</div>}
      {tag}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATS dashboard
// ─────────────────────────────────────────────────────────────
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
function StatsScreen({ stats, onShare }) {
  const maxDay = Math.max(...stats.byDay, 1);
  const rice = Math.round(stats.kcalTotal / 300);
  const movies = Math.floor(stats.savedTotal / 15000);
  return (
    <Body style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ font: '800 24px var(--font-chunky)', color: 'var(--ink)', letterSpacing: .3, marginBottom: 2 }}>내 절제력 통계</div>
        <div style={{ font: '600 13px var(--font-body)', color: 'var(--ink2)', marginBottom: 16 }}>참을수록 숫자가 커져요</div>

        {/* hero */}
        <Card style={{ padding: 20, marginBottom: 14, background: 'linear-gradient(135deg,#FF6A3D,#E8431F)', boxShadow: '0 16px 32px -12px rgba(232,67,31,.6)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -10, top: -10, fontSize: 96, opacity: .16 }}>🔥</div>
          <div style={{ font: '600 13px var(--font-body)', opacity: .9 }}>이번 달 아낀 돈</div>
          <div style={{ font: '800 40px var(--font-chunky)', letterSpacing: .5, fontVariantNumeric: 'tabular-nums', margin: '2px 0 4px' }}>{fmtWon(stats.savedMonth)}</div>
          <div style={{ font: '600 12.5px var(--font-body)', opacity: .92 }}>🏆 {stats.streak}일 연속 참는 중 · 누적 {fmtWon(stats.savedTotal)}</div>
        </Card>

        {/* 3 tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { v: fmtNum(stats.kcalTotal), u: 'kcal 덜 먹음', c: 'var(--primary)', e: '🔥' },
            { v: stats.resisted, u: '번 참음', c: 'var(--green)', e: '✋' },
            { v: stats.streak, u: '일 연속', c: 'var(--amber-ink)', e: '📅' },
          ].map(x => (
            <Card key={x.u} style={{ padding: '14px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{x.e}</div>
              <div style={{ font: '800 19px var(--font-chunky)', color: x.c, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{x.v}</div>
              <div style={{ font: '600 10.5px var(--font-body)', color: 'var(--ink3)', marginTop: 4 }}>{x.u}</div>
            </Card>
          ))}
        </div>

        {/* weekly chart */}
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ font: '800 14px var(--font-display)', color: 'var(--ink)', marginBottom: 14 }}>이번 주 아낀 돈</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, gap: 8 }}>
            {stats.byDay.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ font: '700 9.5px var(--font-body)', color: 'var(--ink3)', fontVariantNumeric: 'tabular-nums' }}>{v > 0 ? Math.round(v / 1000) + 'k' : ''}</span>
                <div style={{ width: '100%', height: Math.max(4, (v / maxDay) * 84), borderRadius: 7, background: v === maxDay ? 'var(--primary)' : 'var(--primary-soft)', transition: 'height .4s' }} />
                <span style={{ font: '600 11px var(--font-body)', color: 'var(--ink2)' }}>{DAYS[i]}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* fun conversions */}
        <div style={{ font: '800 16px var(--font-display)', color: 'var(--ink)', marginBottom: 10 }}>그래서 이만큼이에요</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {[
            { e: '🍚', t: `안 먹은 칼로리 = 공깃밥 ${rice}개`, s: `${fmtNum(stats.kcalTotal)}kcal` },
            { e: '🎬', t: `아낀 돈 = 영화 ${movies}편`, s: fmtWon(stats.savedTotal) },
            { e: '🍗', t: `가장 많이 참은 메뉴 = ${stats.topCat}`, s: '명예의 적' },
          ].map(x => (
            <Card key={x.t} style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ fontSize: 26 }}>{x.e}</span>
              <div style={{ flex: 1, font: '700 13.5px var(--font-body)', color: 'var(--ink)' }}>{x.t}</div>
              <span style={{ font: '700 12px var(--font-body)', color: 'var(--ink3)' }}>{x.s}</span>
            </Card>
          ))}
        </div>
        <div style={{ height: 6 }} />
      </div>
      <TgMainButton label="공유 카드 만들기" sub="친구한테 자랑하기 📤" icon="sparkle" onClick={onShare} />
    </Body>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARE CARD (overlay)
// ─────────────────────────────────────────────────────────────
function ShareCard({ stats, onClose, onToast }) {
  const maxDay = Math.max(...stats.byDay, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(20,12,8,.55)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ font: '800 17px var(--font-display)', color: '#fff' }}>공유 카드</span>
          <button onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="x" size={18} stroke={2.4} /></button>
        </div>

        {/* the card */}
        <div style={{ borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(160deg,#2a1d14,#3d2a1c 60%,#52331f)', boxShadow: '0 24px 50px rgba(0,0,0,.5)', color: '#fff', padding: 24, position: 'relative' }}>
          <div style={{ position: 'absolute', right: -16, top: -16, fontSize: 120, opacity: .1 }}>🔥</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <span style={{ font: '800 16px var(--font-display)', letterSpacing: .3 }}>배달의 만족</span>
            <span style={{ font: '600 11px var(--font-body)', color: 'rgba(255,255,255,.6)' }}>2026.06 리포트</span>
          </div>
          <div style={{ font: '600 13px var(--font-body)', color: 'rgba(255,255,255,.7)' }}>이번 달, 시켜놓고 참아서</div>
          <div style={{ font: '800 44px var(--font-chunky)', color: 'var(--primary)', letterSpacing: .5, lineHeight: 1.05, margin: '6px 0', fontVariantNumeric: 'tabular-nums' }}>{fmtWon(stats.savedMonth)}</div>
          <div style={{ font: '700 14px var(--font-display)', marginBottom: 22 }}>아끼고 {fmtNum(stats.kcalTotal)}kcal 덜 먹었어요</div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 56, gap: 6, marginBottom: 18 }}>
            {stats.byDay.map((v, i) => (
              <div key={i} style={{ flex: 1, height: Math.max(5, (v / maxDay) * 56), borderRadius: 5, background: v === maxDay ? 'var(--primary)' : 'rgba(255,255,255,.22)' }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 22, borderTop: '1px solid rgba(255,255,255,.14)', paddingTop: 16 }}>
            {[['🔥', stats.streak + '일', '연속'], ['✋', stats.resisted + '번', '참음'], ['🏆', stats.topCat, '최다 적']].map(x => (
              <div key={x[2]}>
                <div style={{ font: '800 18px var(--font-chunky)', color: '#fff', lineHeight: 1, whiteSpace: 'nowrap' }}>{x[0]} {x[1]}</div>
                <div style={{ font: '600 11px var(--font-body)', color: 'rgba(255,255,255,.55)', marginTop: 3, whiteSpace: 'nowrap' }}>{x[2]}</div>
              </div>
            ))}
          </div>
          <div style={{ font: '600 11px var(--font-body)', color: 'rgba(255,255,255,.45)', marginTop: 18, textAlign: 'center' }}>＠배달의_만족 · 참아서 만든 기록</div>
        </div>

        {/* share targets */}
        <div style={{ display: 'flex', justifycontent: 'center', gap: 12, marginTop: 22, justifyContent: 'center' }}>
          {[['💾', '저장'], ['🔗', '링크'], ['📷', '인스타'], ['💬', '카톡']].map(x => (
            <button key={x[1]} onClick={() => onToast(`${x[1]} (으)로 공유했어요!`)} style={{ flex: 1, border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 14, padding: '14px 0', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 22 }}>{x[0]}</span>
              <span style={{ font: '700 11.5px var(--font-body)' }}>{x[1]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { FeedScreen, StatsScreen, ShareCard });
