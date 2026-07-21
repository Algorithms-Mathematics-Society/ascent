import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { site } from "@/content/site";

// Self-hosted fonts (no external CDN, no layout shift).
import "@fontsource/eb-garamond/600.css";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";

import "./globals.css";

export const preferredRegion = "bom1";

export const metadata: Metadata = {
  title: site.seo.title,
  description: site.seo.description,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      style={
        {
          "--font-geist": "'Geist Sans'",
          "--font-jetbrains": "'JetBrains Mono'",
          "--font-eb-garamond": "'EB Garamond'",
        } as CSSProperties
      }
    >
      <body className="bg-ascent-canvas font-sans text-ascent-ink antialiased">
        {children}
      </body>
    </html>
  );
}
