import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import CertificatePortal from "@/components/certificates/CertificatePortal";

export const dynamic = "force-dynamic";

const garamond = localFont({
  src: "../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-eb-garamond",
});

export const metadata: Metadata = {
  title: "Your certificate | Ascent",
  description: "Round 1 qualifiers can download their Ascent ’26 certificate with a one-time email code.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

/** The session cookie is httpOnly, so only its presence is read here. The client restores the summary. */
export default function CertificatePage({
  searchParams,
}: {
  searchParams?: { expired?: string | string[] };
}) {
  const expired = searchParams?.expired === "1";
  const hasSession = cookies().has("ascent_certificate_session");
  return (
    <div className={garamond.variable}>
      <Navbar page="certificate" />
      <CertificatePortal hasSession={hasSession} expired={expired} />
      <Footer homeHref="/" />
    </div>
  );
}
