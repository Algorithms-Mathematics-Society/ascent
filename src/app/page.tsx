// src/app/page.tsx
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HomeCacheField from "@/components/sections/HomeCacheField";
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
      <main id="top" tabIndex={-1} className="relative isolate">
        <HomeCacheField />
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
