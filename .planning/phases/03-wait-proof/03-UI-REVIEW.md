# Phase 3 — UI Review

**Audited:** 2026-06-09
**Baseline:** No UI-SPEC.md for this phase. Audited against `design-reference/screens-flow.jsx` (DeliveryScreen + PostScreen — the pixel contract per D-01/D-14) and abstract 6-pillar standards, with CLAUDE.md brand tokens + Money HARD RULE.
**Screenshots:** Not captured. No dev server for THIS project (port 3000/8080 down; port 5173 served an unrelated Svelte/Supabase/Mapbox app, not `fakebm`). Playwright MCP unavailable. Code-only audit from JSX/CSS vs the design-reference source.
**Registry audit:** Skipped — no `components.json` (shadcn not initialized).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every locked string present verbatim (영수증/응원/배지/스킵); empty/error/upload copy added beyond prototype, tone stays 절약/선택 |
| 2. Visuals | 2/4 | **BLOCKER:** `var(--shadow)` is undefined (token is `--shadow-card`) — map card, stepper circles, and receipt render with NO warm shadow; zigzag receipt edge lost its mask |
| 3. Color | 3/4 | Tokens correctly namespaced to `--color-*`; gauge gradient + rider glow exact. One undefined-var defect (shadow) bleeds in; raw hex confined to ported map/cheer/pin literals |
| 4. Typography | 4/4 | Font roles (chunky/display/body) match prototype line-for-line; Money HARD RULE honored everywhere — no ₩ in a BM display span |
| 5. Spacing | 4/4 | Spacing values transcribed 1:1 from prototype (px-faithful port); no arbitrary drift |
| 6. Experience Design | 4/4 | Loading/error/disabled/empty all handled; dual-photo gate + cancel-confirm modal + 409 dedupe; server-authority arrival is correct |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Undefined `var(--shadow)` kills the warm card shadow on 3 core surfaces (BLOCKER)** — The map card (`DeliveryClient.tsx:148`), the stepper step circles (`DeliveryClient.tsx:285`), and the fake receipt (`PostClient.tsx:134`) all set `boxShadow: 'var(--shadow)'`, but `globals.css` defines the token as `--shadow-card` (line 40). `var(--shadow)` resolves to nothing, so these surfaces are flat — directly violating CLAUDE.md's "warm shadows" brand identity and diverging from the prototype's `boxShadow: 'var(--shadow)'` intent (the prototype's `--shadow` maps to this project's `--shadow-card`). The receipt in particular looks like a plain white block instead of a floating slip. **Fix:** replace all three `'var(--shadow)'` with `'var(--shadow-card)'` (matching `Card.tsx:20` and `HomeClient.tsx:284`).

2. **Receipt zigzag bottom edge lost its mask — renders as diagonal stripes, not a torn edge (WARNING)** — Prototype (`screens-flow.jsx:183`) builds the torn-paper bottom with `repeating-linear-gradient(...transparent/#fff...)` PLUS `WebkitMaskImage: 'linear-gradient(#000,#000)'`. The port (`PostClient.tsx:223-231`) drops the `WebkitMaskImage` and swaps `#fff`→`var(--color-surface)`. Without the mask the element is just a 10px band of diagonal surface-colored stripes over the page bg — it reads as a striped bar, not a perforated receipt tear. **Fix:** restore the mask (or, better, implement the tear as a true zigzag via `clip-path`/`mask` so the receipt bottom looks perforated against `--color-bg`).

3. **Stepper-circle shadow defect compounds the flat look (BLOCKER, same root cause)** — Each `done`/`active`/`idle` step circle (`DeliveryClient.tsx:285`) relies on `var(--shadow)` to lift it off the cream bg; with the token undefined the coral "done" circles sit flat and the active 2px coral ring is the only depth cue. This is the same one-line fix as #1 but listed separately because it degrades the *primary focal element* of the wait screen (the progress stepper), not just a container. **Fix:** `var(--shadow)` → `var(--shadow-card)`.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
Strongest pillar. All CONTEXT-locked copy is present verbatim and tone is on-spec.

- **Receipt copy exact (D-14):** "배달의 만족" / "＊＊ 안 먹음 인증 영수증 ＊＊" / "강철 절제력" / "결제 예정액" line-through / "실제 결제 ₩0" / "＊ 본 주문은 시키지 않았습니다 ＊" — `PostClient.tsx:140,143,151,197-210,220`. Matches `screens-flow.jsx:166-180` 1:1.
- **STAGES / CHEERS:** transcribed verbatim — `DeliveryClient.tsx:32-44` vs `screens-flow.jsx:3-9`. (Note: the impl correctly drops the per-stage `msg` field, which the prototype declared but never rendered — no loss.)
- **Arrival + payoff:** "참기 성공!" + "<Won> 아끼고 <Num>kcal 덜 먹었어요" (`DeliveryClient.tsx:227,241-243`); payoff badges "아낀 돈"/"덜 먹은 kcal" (`PostClient.tsx:289-300`). Tone is 절약/선택, never 굶기. ✓ spec.
- **CTAs match `<specifics>`:** "인증하러 가기 · 가짜 영수증 + 내 식단 올리기" (camera) and "피드에 올리기 · 명예의 전당에 인증이 박제돼요 🏆" (share) — `DeliveryClient.tsx:409-413`, `PostClient.tsx:311-313`.
- **Copy ADDED beyond prototype, all on-tone:** empty/gate hint "두 사진 모두 올려야 인증할 수 있어요" (`PostClient.tsx:259`), disabled CTA sub "두 사진을 모두 올려주세요" (`:313`), upload states "올리는 중…" / "실패 · 다시 시도" (`PhotoUploadSlot.tsx:115,125`), submit errors "인증 저장에 실패했어요…" / "네트워크 오류예요…" (`PostClient.tsx:112,119`), and the well-written cancel modal "참기를 포기할까요?" + "지금 나가면 이번 참기는 완주로 기록되지 않아요. 조금만 더 버텨볼까요?" with "계속 참을게요"/"그만 참을래요" (`CancelModal.tsx:58-90`). All encouraging, no generic "확인/취소/실패".
- Grep for generic labels (Submit/OK/Cancel/No data/went wrong) on the audited files: zero hits.

No issues. 4/4.

### Pillar 2: Visuals (2/4)
The structure and hierarchy are faithfully ported, but a token defect strips depth from the three most important surfaces — a real, shipping-visible regression vs the prototype.

- **BLOCKER — undefined shadow token (3 sites):** `boxShadow: 'var(--shadow)'` at `DeliveryClient.tsx:148` (map card), `DeliveryClient.tsx:285` (stepper circles), `PostClient.tsx:134` (receipt). The defined token is `--shadow-card` (`globals.css:40`). Confirmed by grep: these 3 are the ONLY `var(--shadow)` usages in the repo; `Card.tsx:20` and `HomeClient.tsx:284` correctly use `var(--shadow-card)`. Result: the wait screen's focal stepper and the receipt (the proof screen's hero) render flat, contradicting CLAUDE.md "warm shadows" brand and the prototype.
- **WARNING — zigzag receipt edge degraded:** mask dropped (`PostClient.tsx:223-231` vs `screens-flow.jsx:183`); torn-paper effect is lost (see Top Fix #2).
- **Focal point — correct otherwise:** wait screen leads with the 46px coral countdown / 🎉 success block (`DeliveryClient.tsx:205-243`); proof screen leads with the receipt. Hierarchy via size/weight/color is intact.
- **Icon-only buttons labeled:** SubBar back has `aria-label="뒤로"` (`SubBar.tsx:36`); photo slots have dynamic `aria-label` (`PhotoUploadSlot.tsx:88`); cancel modal has `role="dialog" aria-modal aria-label` (`CancelModal.tsx:24-26`). Good a11y.
- **Rider/route/pins/gauge** all structurally faithful; rider crash bug from the prototype (`getPointAt` null) was fixed (`Rider.tsx:25`).

Two specific visual regressions, one a BLOCKER on focal surfaces → 2/4.

### Pillar 3: Color (3/4)
Palette discipline is good; tokens are correctly migrated to the project's `--color-*` namespace (the prototype used bare `--primary` etc.).

- **Accent usage on-spec:** coral confined to route stroke, rider, active stepper, countdown, gauge>50%, receipt footer line, CTAs, and error text — all legitimate accent slots. No accent overuse.
- **Gauge gradient exact (D-specific):** `linear-gradient(90deg,#16A34A,#FFB454,#FF5A33)` (`DeliveryClient.tsx:358`) matches `screens-flow.jsx:98`. Rider glow `rgba(255,90,51,.5)` exact (`Rider.tsx:51`).
- **Raw hex — acceptable, scoped:** hardcoded colors (`#EAF3EE/#DCEAE0` map bg, `#231a14` cheer bar, `#fff` pins, `rgba(...)` shadows) are all ported map/cheer/pin chrome that the prototype also hardcoded — not themeable brand surfaces. CancelModal uses `#2a1d15→#4a2a18` gradient + `#8a5a3a` button (`CancelModal.tsx:33,90`); these are an intentional new "give-up" dark treatment, defensible but NOT tokenized (won't follow a mint theme swap — minor).
- **Defect bleed-through:** the undefined `var(--shadow)` (see Pillar 2) is technically a color/token failure too — it's the one thing keeping this off 4/4.

One token defect + a couple of non-tokenized literals → 3/4.

### Pillar 4: Typography (4/4)
- **Font-role fidelity:** chunky 46px countdown / 24px success (`--font-chunky`), 18px receipt header + 20px "분" + section headers (`--font-display`), all body text (`--font-body`) — line-for-line with the prototype. The "분" suffix, "결제 예정액"/"실제 결제"/"배달의 만족" all correctly use `--font-display`.
- **Money HARD RULE — fully honored (the critical Phase risk):** every ₩/number routes through `<Won>`/`<Num>` (Pretendard, tabular-nums) — arrival summary (`DeliveryClient.tsx:241`), receipt item totals + 결제예정액 (`PostClient.tsx:184,198`), payoff badges (`:289,295`). The literal "₩0" is a plain Pretendard span with `fontVariantNumeric` (`:210`), NOT a BM-font span — the BM ₩-glyph pitfall is avoided. No raw ₩ found in any display-font context.
- Distinct sizes are many but all transcribed from the px-exact prototype, not arbitrary inflation; weights are 500/600/700/800 used consistently by role.

No issues. 4/4.

### Pillar 5: Spacing (4/4)
- Spacing is a faithful px transcription of the prototype: Body padding `16px 16px 0` / `14px 16px 0`, map card `height:196 borderRadius:20 marginBottom:16`, stepper `marginBottom:18`, gauge card `padding:14`, dual-photo `gap:12`, receipt `padding:18px 18px 8px`, inputs `padding:12px 14px borderRadius:12`. All match `screens-flow.jsx`.
- Card radius 18 (`Card.tsx`), button radius 16, receipt `14px 14px 4px 4px`, photo slot 16 — all within the CLAUDE.md 16-20 card-radius brand range; pill buttons (999) present.
- Arbitrary values exist (inline px) but that is the established port style for this codebase (prototype was inline-style); no inconsistent/drifting values introduced. `boxSizing:border-box` on inputs prevents overflow.

No issues. 4/4.

### Pillar 6: Experience Design (4/4)
Strong state coverage; the server-authority interaction model is correctly implemented at the UI layer.

- **Loading:** upload "올리는 중…" (`PhotoUploadSlot.tsx:113-116`); submit guarded by `submitting` with disabled CTA (`PostClient.tsx:76,315`); wait posting guard prevents double-arrive (`DeliveryClient.tsx:107`).
- **Error:** upload error chip "실패 · 다시 시도" (`PhotoUploadSlot.tsx:123-127`); submit error banner with retry-able state reset (`PostClient.tsx:111-121,303-307`); arrive failure deliberately does NOT flip to "참기 성공!" — keeps the user on the wait screen so the ticker/skip retries (`DeliveryClient.tsx:119`, WR-01) — correct, prevents a false success.
- **Empty / gate:** dual-photo required gate (`ready`) drives both the CTA disabled state and the helper line (`PostClient.tsx:81,259,313`) — single-photo proof impossible (D-11/Pitfall 4).
- **Destructive confirm:** back-press opens `CancelModal` with clear consequence copy before abandoning the wait (`DeliveryClient.tsx:137,417-422`, D-07).
- **Dedupe:** 409 on already-posted routes to feed instead of erroring (`PostClient.tsx:106-110`, D-10); SC shells redirect on re-entry (`wait/page.tsx:53-59`, `post/page.tsx:55-63`).
- **Minor (non-scoring) note:** `craving` and `minLeft` derive from `now` ticking every 250ms — fine; `Rider` recomputes path point on every `p` change, smooth. The `data: 'skip'` intent path correctly forces `endured:false`.

No flow-breaking gaps. 4/4.

---

## Files Audited
- `app/(mini)/wait/[id]/page.tsx` (SC shell, deadline ensure, IDOR guard)
- `app/(mini)/wait/[id]/_components/DeliveryClient.tsx` (wait island)
- `app/(mini)/wait/[id]/_components/Rider.tsx`
- `app/(mini)/wait/[id]/_components/CancelModal.tsx`
- `app/(mini)/post/[id]/page.tsx` (SC shell, entry gates)
- `app/(mini)/post/[id]/_components/PostClient.tsx` (proof island)
- `app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx`
- `components/SubBar.tsx`, `components/StatBadge.tsx`, `components/TgMainButton.tsx`, `components/Money.tsx`, `components/Card.tsx`
- `app/globals.css` (design tokens)
- Baselines: `design-reference/screens-flow.jsx`, `.planning/phases/03-wait-proof/03-CONTEXT.md`, `CLAUDE.md`
