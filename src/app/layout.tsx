import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { site } from "@/content/site";
import "./globals.css";

const geist = localFont({
  src: "../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist",
  adjustFontFallback: "Arial",
});
const jetbrains = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  display: "swap",
  variable: "--font-jetbrains",
  adjustFontFallback: false,
  fallback: ["monospace"],
});

export const metadata: Metadata = {
  icons: { icon: "/ascent-logo.svg" },
  title: site.seo.title,
  description: site.seo.description,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${jetbrains.variable}`}>
      <body className="bg-ascent-canvas font-sans text-ascent-ink antialiased">
        {children}
      </body>
    </html>
  );
}
