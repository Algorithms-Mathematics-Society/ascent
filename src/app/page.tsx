// src/app/page.tsx
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Hero,
  CredibilityStrip,
  About,
  Tracks,
  Timeline,
  PrizesCta,
  Faq,
} from "@/components/sections";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="top">
        <Hero />
        <CredibilityStrip />
        <About />
        <Tracks />
        <Timeline />
        <PrizesCta />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
