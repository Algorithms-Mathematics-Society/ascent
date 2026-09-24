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
  metadataBase: new URL("https://ascent.amshq.in"),
  icons: { icon: "/ascent-logo.svg" },
  title: site.seo.title,
  description: site.seo.description,
  openGraph: {
    type: "website",
    siteName: "Ascent",
    title: site.seo.title,
    description: site.seo.description,
    url: "/",
    locale: "en_IN",
  },
  // summary, not summary_large_image: there is no share image yet, and the
  // large card renders as an empty panel without one.
  twitter: {
    card: "summary",
    title: site.seo.title,
    description: site.seo.description,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${jetbrains.variable}`}>
      <head>
        {/*
          Turnstile is the only third-party origin in the candidate flow, and it
          is requested late: BotCheck mounts on the last stage of the form, and
          the submit button stays disabled until the token arrives. Warming DNS,
          TCP and TLS at page load takes that handshake off the critical moment.
          Hints only, so nothing here changes behaviour if they are ignored.
        */}
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
        <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
      </head>
      <body className="bg-ascent-canvas font-sans text-ascent-ink antialiased">
        {children}
      </body>
    </html>
  );
}
