import type { Metadata, Viewport } from "next";
import { bmHanna, bmDohyeon, bmJua } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "배달의 만족",
  description:
    "시켜놓고, 참는다 — 가짜 주문으로 식비를 아끼고 칼로리를 덜 먹는 텔레그램 미니앱.",
};

// viewport-fit=cover is required so env(safe-area-inset-*) resolves on notched
// devices; the Mini App renders edge-to-edge inside the Telegram webview.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFF7F1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      data-theme="coral"
      className={`${bmHanna.variable} ${bmDohyeon.variable} ${bmJua.variable}`}
    >
      <body
        style={{
          // Fill the dynamic viewport (dvh as the modern default; an svh
          // fallback is layered via the data attribute below). The status-bar
          // safe area uses env(safe-area-inset-top) — NOT the prototype's
          // hardcoded 54px.
          minHeight: "100dvh",
          paddingTop: "env(safe-area-inset-top)",
          background: "var(--color-bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
