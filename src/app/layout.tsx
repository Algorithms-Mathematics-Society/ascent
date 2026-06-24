import type { Metadata } from "next";

// Self-hosted fonts (no external CDN, no layout shift).
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";

import "./globals.css";

export const metadata: Metadata = {
  title: "AMS Ascent — The C++ Ascent",
  description:
    "AMS Ascent is a C++ competitive-programming event. Climb the C++ ladder through algorithmic rounds — from prelims to finals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      style={
        {
          "--font-geist": "'Geist Sans'",
          "--font-jetbrains": "'JetBrains Mono'",
        } as React.CSSProperties
      }
    >
      <body className="font-sans bg-ascent-bg text-ascent-ink antialiased">
        {children}
      </body>
    </html>
  );
}
