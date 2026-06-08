/**
 * lib/catalog.ts — immutable seed catalog (ported verbatim from
 * design-reference/data.jsx lines 90–186).
 *
 * These are the seed-snapshot constants: Order/Post records snapshot the
 * relevant menu/restaurant fields at write time (ARCHITECTURE seed-snapshot
 * pattern), so this catalog is an immutable source of truth, NOT a mutable
 * store. The prototype's `Object.assign(window, …)` export (data.jsx line 189)
 * is dropped in favour of ES-module `export const`s with TS types.
 */

export interface Category {
  readonly key: string;
  readonly emoji: string;
}

export interface MenuItem {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly price: number;
  readonly kcal: number;
  readonly desc: string;
}

export interface Restaurant {
  readonly id: string;
  readonly name: string;
  readonly cat: string;
  readonly emoji: string;
  readonly rating: number;
  readonly reviews: number;
  readonly eta: string;
  readonly delivery: number;
  readonly tag: string;
  readonly menu: readonly MenuItem[];
}

/** A menu item enriched with its parent restaurant name + category. */
export interface AllMenuEntry extends MenuItem {
  readonly rest: string;
  readonly cat: string;
}

export interface SeedPost {
  readonly id: string;
  readonly user: string;
  readonly day: number;
  readonly time: string;
  readonly rest: string;
  readonly items: readonly string[];
  readonly cat: string;
  readonly emoji: string;
  readonly saved: number;
  readonly kcal: number;
  readonly likes: number;
  readonly liked: boolean;
  readonly caption: string;
  readonly diet: string;
  readonly foodSlot: string;
  readonly dietSlot: string;
}

// ── categories ───────────────────────────────────────────────
export const CATEGORIES: readonly Category[] = [
  { key: '치킨', emoji: '🍗' }, { key: '떡볶이', emoji: '🍢' }, { key: '피자', emoji: '🍕' },
  { key: '버거', emoji: '🍔' }, { key: '족발', emoji: '🥓' }, { key: '야식', emoji: '🌙' },
  { key: '곱창', emoji: '🥘' }, { key: '마라', emoji: '🌶️' }, { key: '중식', emoji: '🥡' },
  { key: '디저트', emoji: '🍰' },
] as const;

// ── restaurants + menus ──────────────────────────────────────
export const RESTAURANTS: readonly Restaurant[] = [
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
] as const;

// Derived id → enriched-menu map (preserve the prototype derivation exactly:
// data.jsx lines 157–158).
export const ALL_MENU: Readonly<Record<string, AllMenuEntry>> = (() => {
  const map: Record<string, AllMenuEntry> = {};
  RESTAURANTS.forEach((r) =>
    r.menu.forEach((m) => {
      map[m.id] = { ...m, rest: r.name, cat: r.cat };
    }),
  );
  return map;
})();

// ── seeded feed posts ────────────────────────────────────────
export const SEED_POSTS: readonly SeedPost[] = [
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
] as const;
