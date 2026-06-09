# Phase 04 — Deferred Items (out-of-scope discoveries)

Logged during execution; NOT fixed (SCOPE BOUNDARY — only auto-fix issues caused by the current task).

## 04-03 (like toggle)

Pre-existing `npm run lint` errors in files unrelated to the like slice (8 errors).
None are in the like route/tests; the build still passes. React-Compiler-style rules:

| File | Rule | Note |
|------|------|------|
| app/(mini)/_components/WelcomeIntro.tsx | setState synchronously within an effect | pre-existing |
| app/(mini)/wait/[id]/_components/DeliveryClient.tsx | setState synchronously within an effect | pre-existing |
| app/(mini)/wait/[id]/_components/Rider.tsx | Cannot call impure function during render (×4) | pre-existing |
| components/Burst.tsx | setState synchronously within an effect | pre-existing |
| lib/cart.tsx | setState synchronously within an effect | pre-existing |

Recommend a dedicated lint-cleanup plan/quick before phase close.
