// src/app/page.tsx
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Hero,
  About,
  Tracks,
  Timeline,
  RegistrationCta,
  Faq,
} from "@/components/sections";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="top" tabIndex={-1}>
        <Hero />
        <About />
        <Tracks />
        <Timeline />
        <RegistrationCta />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
