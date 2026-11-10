import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";

const garamond = localFont({
  src: "../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-eb-garamond",
});

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function VerifyLayout({ children }: { children: ReactNode }) {
  return <div className={garamond.variable}>{children}</div>;
}
