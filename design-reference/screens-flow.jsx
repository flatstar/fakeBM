// screens-flow.jsx — Delivery wait + Proof (인증) post creation

const STAGES = [
  { k: '접수', e: '🧾', msg: '주문 들어갔어요. (물론 가짜로요 😎)' },
  { k: '조리중', e: '🍳', msg: '지글지글… 냄새나는 척 상상만 하세요.' },
  { k: '배달출발', e: '🛵', msg: '라이더님이 출발했어요. 침 고이는 거 참기!' },
  { k: '곧도착', e: '📍', msg: '거의 다 왔어요. 조금만 더 버텨요!' },
];
const CHEERS = ['지금 이 순간이 제일 힘들어요 💪', '5분 뒤엔 시킨 걸 까먹어요, 진짜로.', '냉장고 말고 물 한 잔 어때요? 🥤', '여기서 참으면 통계가 빛나요 ✨', '배고픔은 파도예요. 곧 빠져나가요 🌊'];

function DeliveryScreen({ order, onArrive, onCancel, durationMs = 13000 }) {
  const rest = RESTAURANTS.find(r => r.id === order.restId);
  const DURATION = durationMs; // demo
  const [elapsed, setElapsed] = React.useState(0);
  const [cheer, setCheer] = React.useState(0);
  const startRef = React.useRef(Date.now());

  React.useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - startRef.current), 90);
    return () => clearInterval(iv);
  }, []);
  React.useEffect(() => {
    const c = setInterval(() => setCheer(x => (x + 1) % CHEERS.length), 2600);
    return () => clearInterval(c);
  }, []);

  const p = Math.min(elapsed / DURATION, 1);          // 0..1
  const arrived = p >= 1;
  const stageIdx = arrived ? 4 : Math.min(Math.floor(p * 4), 3);
  const fakeMinLeft = Math.max(0, Math.ceil((1 - p) * 38));
  const craving = Math.round((1 - p) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <SubBar title={arrived ? '배달 완료' : '배달 중'} onBack={onCancel} />
      <Body style={{ padding: '16px 16px 0' }}>
        {/* map card */}
        <div style={{ position: 'relative', height: 196, borderRadius: 20, overflow: 'hidden', marginBottom: 16, background: 'linear-gradient(160deg,#EAF3EE,#DCEAE0)', boxShadow: 'var(--shadow)' }}>
          {/* faux streets */}
          <svg width="100%" height="100%" viewBox="0 0 360 196" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <g stroke="#fff" strokeWidth="9" opacity="0.7" strokeLinecap="round">
              <path d="M-10 60 H370" /><path d="M-10 140 H370" /><path d="M90 -10 V210" /><path d="M250 -10 V210" />
            </g>
            <g stroke="#CBDDD0" strokeWidth="2" opacity="0.8">
              <path d="M-10 100 H370" /><path d="M170 -10 V210" /><path d="M320 -10 V210" />
            </g>
            {/* route */}
            <path id="route" d="M55 158 C 120 150, 120 80, 180 70 S 270 50, 305 40" fill="none" stroke="var(--primary)" strokeWidth="4" strokeDasharray="2 9" strokeLinecap="round" opacity="0.9" />
          </svg>
          {/* store + home pins */}
          <Pin x={55} y={158} label="가게" e={rest.emoji} />
          <Pin x={305} y={40} label="우리집" e="🏠" />
          {/* rider */}
          <Rider p={p} />
          <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(35,26,20,.85)', color: '#fff', font: '700 11.5px var(--font-body)', padding: '5px 10px', borderRadius: 999 }}>
            {arrived ? '🏠 문 앞 도착!' : `🛵 ${rest.name}`}
          </div>
        </div>

        {/* countdown / arrived */}
        {!arrived ? (
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ font: '600 13px var(--font-body)', color: 'var(--ink3)' }}>{STAGES[stageIdx].e} {STAGES[stageIdx].k} · 도착까지</div>
            <div style={{ font: '800 46px/1.1 var(--font-chunky)', color: 'var(--primary)', letterSpacing: 1, fontVariantNumeric: 'tabular-nums' }}>{fakeMinLeft}<span style={{ font: '700 20px var(--font-display)', color: 'var(--ink2)' }}>분</span></div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 44 }}>🎉</div>
            <div style={{ font: '800 24px var(--font-chunky)', color: 'var(--ink)', letterSpacing: .4 }}>참기 성공!</div>
            <div style={{ font: '600 13.5px var(--font-body)', color: 'var(--ink2)', marginTop: 3 }}>{fmtWon(order.total)} 아끼고 {fmtNum(order.kcal)}kcal 덜 먹었어요</div>
          </div>
        )}

        {/* stage stepper */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 4px', marginBottom: 18 }}>
          {STAGES.map((s, i) => {
            const done = i < stageIdx || arrived, active = i === stageIdx && !arrived;
            return (
              <React.Fragment key={s.k}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 58 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: done ? 'var(--primary)' : active ? 'var(--primary-soft)' : 'var(--surface)', boxShadow: 'var(--shadow)', border: active ? '2px solid var(--primary)' : 'none', transition: 'all .2s' }}>
                    {done ? <Icon name="check" size={18} color="#fff" stroke={3} /> : s.e}
                  </div>
                  <span style={{ font: active || done ? '700 10.5px var(--font-body)' : '500 10.5px var(--font-body)', color: done ? 'var(--primary)' : active ? 'var(--ink)' : 'var(--ink3)', textAlign: 'center', whiteSpace: 'nowrap' }}>{s.k}</span>
                </div>
                {i < STAGES.length - 1 && <div style={{ flex: 1, height: 3, borderRadius: 2, background: i < stageIdx || arrived ? 'var(--primary)' : 'var(--line)', marginTop: 18, transition: 'all .3s' }} />}
              </React.Fragment>
            );
          })}
        </div>

        {!arrived && (
          <>
            {/* craving meter */}
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '700 12.5px var(--font-body)', color: 'var(--ink2)', marginBottom: 8 }}><span style={{ whiteSpace: 'nowrap' }}>🤤 식욕 게이지</span><span style={{ color: craving > 50 ? 'var(--primary)' : 'var(--green)' }}>{craving}%</span></div>
              <div style={{ height: 10, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: craving + '%', borderRadius: 999, background: 'linear-gradient(90deg,#16A34A,#FFB454,#FF5A33)', transition: 'width .3s' }} />
              </div>
            </Card>
            {/* cheer */}
            <div style={{ background: '#231a14', color: '#fff', borderRadius: 16, padding: '15px 16px', font: '600 14px var(--font-body)', display: 'flex', alignItems: 'center', gap: 10, minHeight: 54 }}>
              <span style={{ fontSize: 20 }}>📣</span>
              <span key={cheer}>{CHEERS[cheer]}</span>
            </div>
            <div style={{ height: 8 }} />
            <button onClick={() => { startRef.current = Date.now() - DURATION; setElapsed(DURATION); }} style={{ width: '100%', border: 'none', background: 'none', color: 'var(--ink3)', font: '600 12.5px var(--font-body)', padding: 10, cursor: 'pointer', textDecoration: 'underline' }}>
              데모: 바로 도착시키기 →
            </button>
          </>
        )}
        <div style={{ height: 8 }} />
      </Body>
      {arrived && <TgMainButton label="인증하러 가기" sub="가짜 영수증 + 내 식단 올리기" icon="camera" onClick={onArrive} />}
    </div>
  );
}

function Pin({ x, y, label, e }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 4 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, boxShadow: '0 4px 10px rgba(0,0,0,.18)', border: '2px solid var(--primary)' }}>{e}</div>
      <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #fff', marginTop: -1 }} />
      <span style={{ font: '700 10px var(--font-body)', color: 'var(--ink)', background: '#fff', padding: '1px 6px', borderRadius: 999, marginTop: 2, boxShadow: '0 2px 5px rgba(0,0,0,.12)' }}>{label}</span>
    </div>
  );
}

function Rider({ p }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ x: 55, y: 158, a: 0 });
  React.useEffect(() => {
    const path = document.getElementById('route');
    if (!path) return;
    const len = path.getTotalLength();
    const pt = path.getPointAt ? null : path.getPointAtLength(len * p);
    const p2 = path.getPointAtLength(Math.min(len, len * p + 1));
    const ang = Math.atan2(p2.y - pt.y, p2.x - pt.x) * 180 / Math.PI;
    setPos({ x: pt.x, y: pt.y, a: ang });
  }, [p]);
  return (
    <div ref={ref} style={{ position: 'absolute', left: pos.x, top: pos.y, transform: 'translate(-50%,-50%)', zIndex: 5, transition: 'left .12s linear, top .12s linear' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 12px rgba(255,90,51,.5)', border: '2.5px solid #fff', fontSize: 18 }}>🛵</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROOF (인증) — fake receipt + dual photos + diet
// ─────────────────────────────────────────────────────────────
function PostScreen({ order, onPost, onCancel }) {
  const rest = RESTAURANTS.find(r => r.id === order.restId);
  const entries = Object.entries(order.items);
  const [caption, setCaption] = React.useState('');
  const [diet, setDiet] = React.useState('');
  const ph = '치킨 시키려다 참고 닭가슴살 구웠어요 🍗→🥗';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <SubBar title="인증 올리기" onBack={onCancel} />
      <Body style={{ padding: '14px 16px 0' }}>
        {/* fake receipt */}
        <div style={{ position: 'relative', marginBottom: 18 }}>
          <div style={{ background: '#fff', borderRadius: '14px 14px 4px 4px', padding: '18px 18px 8px', boxShadow: 'var(--shadow)', fontFamily: 'var(--font-body)' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed var(--line)', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ font: '800 18px var(--font-display)', color: 'var(--ink)', letterSpacing: .5 }}>배달의 만족</div>
              <div style={{ font: '600 11px var(--font-body)', color: 'var(--ink3)', marginTop: 2 }}>＊＊ 안 먹음 인증 영수증 ＊＊</div>
            </div>
            {[['가게', rest.name], ['주문번호', order.orderNo], ['주문시각', order.time], ['결제수단', '강철 절제력']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, font: '600 12.5px var(--font-body)', color: 'var(--ink2)', marginBottom: 5 }}><span style={{ color: 'var(--ink3)', whiteSpace: 'nowrap' }}>{k}</span><span style={{ color: 'var(--ink)', textAlign: 'right' }}>{v}</span></div>
            ))}
            <div style={{ borderTop: '2px dashed var(--line)', margin: '10px 0' }} />
            {entries.map(([id, q]) => {
              const m = ALL_MENU[id];
              return <div key={id} style={{ display: 'flex', justifyContent: 'space-between', font: '600 12.5px var(--font-body)', color: 'var(--ink)', marginBottom: 5 }}><span>{m.name} ×{q}</span><span>{fmtWon(m.price * q)}</span></div>;
            })}
            <div style={{ borderTop: '2px dashed var(--line)', margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '800 14px var(--font-body)', color: 'var(--ink3)', marginBottom: 6 }}><span style={{ fontFamily: 'var(--font-display)' }}>결제 예정액</span><span style={{ textDecoration: 'line-through' }}>{fmtWon(order.total)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '800 16px var(--font-body)', color: 'var(--green)' }}><span style={{ fontFamily: 'var(--font-display)' }}>실제 결제</span><span>₩0</span></div>
            <div style={{ textAlign: 'center', font: '700 12px var(--font-body)', color: 'var(--primary)', margin: '12px 0 4px' }}>＊ 본 주문은 시키지 않았습니다 ＊</div>
          </div>
          {/* zigzag bottom edge */}
          <div style={{ height: 10, background: 'repeating-linear-gradient(135deg, transparent 0 6px, #fff 6px 12px)', WebkitMaskImage: 'linear-gradient(#000,#000)', filter: 'drop-shadow(0 6px 6px rgba(150,70,30,.06))' }} />
        </div>

        {/* dual photos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
          <PhotoSlot id="post_new_food" label="시킨 척한 음식" hint="🤤 먹고 싶었던 것" />
          <PhotoSlot id="post_new_diet" label="실제 내 식단" hint="🥗 진짜 먹은 것" />
        </div>
        <div style={{ font: '500 11.5px var(--font-body)', color: 'var(--ink3)', textAlign: 'center', marginBottom: 16 }}>사진을 끌어다 놓거나 탭해서 채워보세요</div>

        {/* diet text */}
        <div style={{ font: '700 13px var(--font-body)', color: 'var(--ink2)', marginBottom: 6 }}>실제로 먹은 식단</div>
        <input value={diet} onChange={e => setDiet(e.target.value)} placeholder="예: 닭가슴살 150g + 방울토마토 (320kcal)" style={inStyle} />

        {/* caption */}
        <div style={{ font: '700 13px var(--font-body)', color: 'var(--ink2)', margin: '14px 0 6px' }}>한마디</div>
        <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder={ph} rows={3} style={{ ...inStyle, resize: 'none', lineHeight: 1.5 }} />

        {/* payoff badges */}
        <div style={{ display: 'flex', gap: 8, margin: '14px 0 4px' }}>
          <StatBadge icon="won" label="아낀 돈 " value={fmtWon(order.total)} tint={TINT.save} />
          <StatBadge icon="fire" label="덜 먹은 " value={fmtNum(order.kcal) + 'kcal'} tint={TINT.kcal} />
        </div>
        <div style={{ height: 10 }} />
      </Body>
      <TgMainButton label="피드에 올리기" sub="명예의 전당에 인증이 박제돼요 🏆" icon="share" onClick={() => onPost({ caption: caption || ph, diet: diet || '오늘의 건강 식단' })} />
    </div>
  );
}

const inStyle = {
  width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--line)', borderRadius: 12,
  padding: '12px 14px', font: '500 14px var(--font-body)', color: 'var(--ink)', background: 'var(--surface)', outline: 'none',
};

function PhotoSlot({ id, label, hint }) {
  return (
    <div>
      <div style={{ font: '700 12px var(--font-body)', color: 'var(--ink2)', marginBottom: 6, textAlign: 'center' }}>{label}</div>
      <image-slot id={id} shape="rounded" radius="16" placeholder={hint} style={{ width: '100%', height: 130, display: 'block', border: '1.5px dashed var(--line)', borderRadius: 16 }}></image-slot>
    </div>
  );
}

Object.assign(window, { DeliveryScreen, PostScreen });
