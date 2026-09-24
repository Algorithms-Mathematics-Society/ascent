// src/app/page.tsx
import Navbar from "@/components/layout/Navbar";
import StructuredData from "@/components/seo/StructuredData";
import Footer from "@/components/layout/Footer";
import {
  Hero,
  About,
  Tracks,
  Sponsors,
  Timeline,
  RegistrationCta,
  Faq,
} from "@/components/sections";

export default function Home() {
  return (
    <>
      <StructuredData />
      <Navbar />
      <main id="top" tabIndex={-1}>
        <Hero />
        <About />
        <Tracks />
        <Sponsors />
        <Timeline />
        <RegistrationCta />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
