import localFont from 'next/font/local';

// BM display fonts (free for commercial use) — self-hosted via next/font/local.
// Ported from design-reference/배달의 만족.html @font-face block (weight range 400 800
// for BMHanna is load-bearing). Each exposes a CSS variable consumed by the
// `@theme inline` font chain in app/globals.css.

export const bmHanna = localFont({
  src: './fonts/BMHannaPro.ttf',
  variable: '--font-bmhanna',
  weight: '400 800',
  display: 'swap',
});

export const bmDohyeon = localFont({
  src: './fonts/BMDohyeon.ttf',
  variable: '--font-bmdohyeon',
  display: 'swap',
});

// BMJua: load infrastructure only (D-04). Not surfaced in any role contract yet,
// but the variable is wired so later phases can opt in without a re-port.
export const bmJua = localFont({
  src: './fonts/BMJua.ttf',
  variable: '--font-bmjua',
  display: 'swap',
});
