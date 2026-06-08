// data.jsx — 참배달 shared data, icons, helpers (exported to window)

// ── formatters ───────────────────────────────────────────────
const fmtWon = (n) => '₩' + Math.round(n).toLocaleString('ko-KR');
const fmtNum = (n) => Math.round(n).toLocaleString('ko-KR');

// ── icon set (stroke line icons) ─────────────────────────────
function Icon({ name, size = 24, color = 'currentColor', stroke = 2, fill = 'none', style }) {
  const P = { fill, stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5" {...P} /><path d="M5 10v9h14v-9" {...P} /></>,
    feed: <><rect x="3.5" y="4" width="17" height="17" rx="3" {...P} /><path d="M3.5 9.5h17M9 9.5V21" {...P} /></>,
    chart: <><path d="M4 20V10M10 20V5M16 20v-7M21 20H3" {...P} /></>,
    user: <><circle cx="12" cy="8" r="3.6" {...P} /><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" {...P} /></>,
    search: <><circle cx="11" cy="11" r="6.5" {...P} /><path d="m20 20-3.6-3.6" {...P} /></>,
    heart: <path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 14.5 12 20 12 20Z" {...P} />,
    plus: <><path d="M12 5v14M5 12h14" {...P} /></>,
    minus: <path d="M5 12h14" {...P} />,
    back: <path d="M15 5l-7 7 7 7" {...P} />,
    chevron: <path d="M9 5l7 7-7 7" {...P} />,
    chevDown: <path d="M5 9l7 7 7-7" {...P} />,
    clock: <><circle cx="12" cy="12" r="8.4" {...P} /><path d="M12 7.5V12l3 2" {...P} /></>,
    pin: <><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" {...P} /><circle cx="12" cy="10" r="2.6" {...P} /></>,
    receipt: <><path d="M6 3h12v18l-2.2-1.4L13.6 21l-2.2-1.4L9.2 21 7 19.6 4.8 21V3Z" {...P} transform="translate(1,0)" /><path d="M9 8h8M9 12h8M9 16h5" {...P} /></>,
    share: <><circle cx="6" cy="12" r="2.4" {...P} /><circle cx="17" cy="6" r="2.4" {...P} /><circle cx="17" cy="18" r="2.4" {...P} /><path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6" {...P} /></>,
    fire: <path d="M12 3c.5 3-2.5 4-2.5 7a2.5 2.5 0 0 0 5 0c0-.8-.3-1.3-.3-1.3 1.8 1 3.3 2.8 3.3 5.3a5.5 5.5 0 1 1-11 0C6.5 9.5 12 8 12 3Z" {...P} />,
    won: <path d="M5 7l2.4 9L10 8l2 6 2-6 2.6 8L19 7M4 11h16" {...P} />,
    check: <path d="M5 12.5l4.5 4.5L19 7" {...P} />,
    checkCircle: <><circle cx="12" cy="12" r="8.5" {...P} /><path d="M8.5 12.2l2.5 2.5 4.5-5" {...P} /></>,
    star: <path d="M12 4l2.3 4.9 5.2.7-3.8 3.6 1 5.2-4.7-2.6-4.7 2.6 1-5.2L4.5 9.6l5.2-.7L12 4Z" {...P} fill={fill === 'none' ? 'none' : color} />,
    bag: <><path d="M6 8h12l-1 12H7L6 8Z" {...P} /><path d="M9 8a3 3 0 0 1 6 0" {...P} /></>,
    rider: <><circle cx="6" cy="17.5" r="2.5" {...P} /><circle cx="18" cy="17.5" r="2.5" {...P} /><path d="M6 17.5h6l3-6h3M9.5 11.5h4M14 8h2.5l1.5 3.5" {...P} /></>,
    camera: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" {...P} /><circle cx="12" cy="12.5" r="3.2" {...P} /></>,
    sparkle: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3Z" {...P} fill={fill === 'none' ? 'none' : color} />,
    trophy: <><path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" {...P} /><path d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3M10 13.5h4M9 20h6M12 13.5V16" {...P} /></>,
    leaf: <><path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14 0 0 .5-4 4-7" {...P} /></>,
    x: <path d="M6 6l12 12M18 6L6 18" {...P} />,
    pencil: <><path d="M5 19l1-4L16 5l3 3L9 18l-4 1Z" {...P} /></>,
    chat: <path d="M5 5h14v10H9l-4 4V5Z" {...P} />,
    bookmark: <path d="M7 4h10v16l-5-3.5L7 20V4Z" {...P} />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">{paths[name]}</svg>
  );
}

// ── avatar (initials, deterministic warm color) ──────────────
const AV_COLORS = ['#FF8A5B', '#FFB454', '#6FB98F', '#7AA7E0', '#C58BE0', '#E08BA9', '#5FB8B0'];
function Avatar({ name, size = 40, ring = false }) {
  const ch = (name || '?').replace(/[^가-힣A-Za-z0-9]/g, '').slice(0, 1) || '?';
  let h = 0; for (const c of (name || '')) h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length;
  const bg = AV_COLORS[h];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
      color: '#fff', fontWeight: 800, fontSize: size * 0.42,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: ring ? '0 0 0 2.5px #fff, 0 0 0 4.5px ' + bg : 'none',
      letterSpacing: -0.5,
    }}>{ch}</div>
  );
}

// ── food "photo" tile — appetizing gradient + dish glyph ─────
const FOOD_BG = {
  치킨: ['#FFE0B0', '#FFB155'], 떡볶이: ['#FFC9B8', '#FF6A4D'], 피자: ['#FFD9A8', '#F2913B'],
  버거: ['#FFE2B0', '#E8A24C'], 족발: ['#F2D2B6', '#C98A55'], 야식: ['#FFCBB0', '#FF7A4D'],
  디저트: ['#FFD7E2', '#F08CB0'], 중식: ['#FFE0B8', '#E89A3C'], 곱창: ['#F5C9A8', '#D98246'],
  마라: ['#F3B8A8', '#D9472F'],
};
function FoodTile({ emoji, cat, style, radius = 16, big = false }) {
  const [a, b] = FOOD_BG[cat] || ['#FFDCC2', '#F2A05A'];
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: radius,
      background: `radial-gradient(120% 120% at 25% 15%, ${a}, ${b})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(60% 50% at 78% 88%, rgba(255,255,255,.28), transparent 70%)',
      }} />
      <span style={{ fontSize: big ? 64 : 38, filter: 'drop-shadow(0 3px 6px rgba(120,50,20,.22))' }}>{emoji}</span>
    </div>
  );
}

// ── categories ───────────────────────────────────────────────
const CATEGORIES = [
  { key: '치킨', emoji: '🍗' }, { key: '떡볶이', emoji: '🍢' }, { key: '피자', emoji: '🍕' },
  { key: '버거', emoji: '🍔' }, { key: '족발', emoji: '🥓' }, { key: '야식', emoji: '🌙' },
  { key: '곱창', emoji: '🥘' }, { key: '마라', emoji: '🌶️' }, { key: '중식', emoji: '🥡' },
  { key: '디저트', emoji: '🍰' },
];

// ── restaurants + menus ──────────────────────────────────────
const RESTAURANTS = [
  {
    id: 'r1', name: '밤9시 후라이드', cat: '치킨', emoji: '🍗', rating: 4.8, reviews: 2412,
    eta: '32–47분', delivery: 3000, tag: '바삭함이 죄책감을 부른다',
    menu: [
      { id: 'm1', name: '황금올리브 한마리', emoji: '🍗', price: 20000, kcal: 1640, desc: '바삭+육즙, 위험한 조합' },
      { id: 'm2', name: '양념치킨', emoji: '🍗', price: 21000, kcal: 1780, desc: '단짠의 끝판왕' },
      { id: 'm3', name: '치즈볼 (5개)', emoji: '🧀', price: 6000, kcal: 720, desc: '쭉 늘어나는 그것' },
      { id: 'm4', name: '치킨무·콜라 세트', emoji: '🥤', price: 2000, kcal: 210, desc: '' },
    ],
  },
  {
    id: 'r2', name: '신전 분식포차', cat: '떡볶이', emoji: '🍢', rating: 4.7, reviews: 1890,
    eta: '25–35분', delivery: 2500, tag: '매콤함은 참기 힘들지',
    menu: [
      { id: 'm5', name: '국물 떡볶이', emoji: '🍢', price: 9000, kcal: 680, desc: '쌀떡 쫀득' },
      { id: 'm6', name: '로제 떡볶이', emoji: '🍝', price: 12000, kcal: 920, desc: '크림+매운맛' },
      { id: 'm7', name: '김말이·오징어 튀김', emoji: '🍤', price: 6000, kcal: 540, desc: '' },
      { id: 'm8', name: '치즈 김밥', emoji: '🍙', price: 4500, kcal: 480, desc: '' },
    ],
  },
  {
    id: 'r3', name: '슬라이스 피자랩', cat: '피자', emoji: '🍕', rating: 4.6, reviews: 980,
    eta: '35–50분', delivery: 3500, tag: '한 조각만… 이 거짓말',
    menu: [
      { id: 'm9', name: '페퍼로니 (L)', emoji: '🍕', price: 27000, kcal: 2240, desc: '치즈 폭탄' },
      { id: 'm10', name: '고르곤졸라 (L)', emoji: '🍕', price: 29000, kcal: 2360, desc: '꿀 찍먹' },
      { id: 'm11', name: '갈릭 브레드', emoji: '🥖', price: 7000, kcal: 640, desc: '' },
    ],
  },
  {
    id: 'r4', name: '버거 인 더 박스', cat: '버거', emoji: '🍔', rating: 4.5, reviews: 1560,
    eta: '28–40분', delivery: 3000, tag: '수제버거의 유혹',
    menu: [
      { id: 'm12', name: '더블 베이컨 버거', emoji: '🍔', price: 11500, kcal: 1120, desc: '패티 2장' },
      { id: 'm13', name: '감자튀김 (L)', emoji: '🍟', price: 4500, kcal: 510, desc: '' },
      { id: 'm14', name: '오레오 쉐이크', emoji: '🥤', price: 5500, kcal: 620, desc: '' },
    ],
  },
  {
    id: 'r5', name: '24시 마라공방', cat: '마라', emoji: '🌶️', rating: 4.7, reviews: 1330,
    eta: '30–45분', delivery: 3000, tag: '얼얼한 새벽의 부름',
    menu: [
      { id: 'm15', name: '마라탕 (중)', emoji: '🍲', price: 13000, kcal: 880, desc: '재료 5종' },
      { id: 'm16', name: '꿔바로우', emoji: '🍖', price: 14000, kcal: 1240, desc: '탕수육의 진화' },
      { id: 'm17', name: '꼬치 3종', emoji: '🍢', price: 6000, kcal: 430, desc: '' },
    ],
  },
  {
    id: 'r6', name: '심야 디저트29', cat: '디저트', emoji: '🍰', rating: 4.9, reviews: 760,
    eta: '20–30분', delivery: 2500, tag: '달콤함은 반칙이야',
    menu: [
      { id: 'm18', name: '바스크 치즈케이크', emoji: '🍰', price: 8500, kcal: 540, desc: '' },
      { id: 'm19', name: '초코 생크림 와플', emoji: '🧇', price: 9000, kcal: 760, desc: '' },
      { id: 'm20', name: '딸기 크로플', emoji: '🥐', price: 7500, kcal: 480, desc: '' },
    ],
  },
];
const ALL_MENU = {};
RESTAURANTS.forEach(r => r.menu.forEach(m => { ALL_MENU[m.id] = { ...m, rest: r.name, cat: r.cat }; }));

// ── seeded feed posts ────────────────────────────────────────
const SEED_POSTS = [
  {
    id: 'p1', user: '참치마요', day: 14, time: '23:41',
    rest: '밤9시 후라이드', items: ['황금올리브 한마리'], cat: '치킨', emoji: '🍗',
    saved: 23000, kcal: 1640, likes: 128, liked: false,
    caption: '치킨이 너무 먹고 싶어서 시켜놓고… 닭가슴살 구웠다. 살았다 진짜. 🐔',
    diet: '닭가슴살 150g + 방울토마토 + 삶은 달걀 2개 (320kcal)',
    foodSlot: 'feed_p1_food', dietSlot: 'feed_p1_diet',
  },
  {
    id: 'p2', user: '오늘부터운동', day: 7, time: '21:08',
    rest: '신전 분식포차', items: ['로제 떡볶이'], cat: '떡볶이', emoji: '🍝',
    saved: 14500, kcal: 920, likes: 86, liked: true,
    caption: '로제 떡볶이 장바구니까지 갔다가 결제 직전에 참음. 두부면으로 비슷하게 만들어 먹음 ㅎㅎ',
    diet: '두부면 로제(라이트) + 닭가슴살 소시지 (390kcal)',
    foodSlot: 'feed_p2_food', dietSlot: 'feed_p2_diet',
  },
  {
    id: 'p3', user: '마라조아', day: 21, time: '00:22',
    rest: '24시 마라공방', items: ['마라탕 (중)', '꿔바로우'], cat: '마라', emoji: '🍲',
    saved: 30000, kcal: 2120, likes: 204, liked: false,
    caption: '새벽 마라탕… 22일째 참는 중. 대신 곤약 마라탕 끓였다. 오늘도 승리 🔥',
    diet: '곤약면 마라탕 + 청경채 듬뿍 (210kcal)',
    foodSlot: 'feed_p3_food', dietSlot: 'feed_p3_diet',
  },
];

// expose
Object.assign(window, {
  fmtWon, fmtNum, Icon, Avatar, FoodTile,
  CATEGORIES, RESTAURANTS, ALL_MENU, SEED_POSTS,
});
