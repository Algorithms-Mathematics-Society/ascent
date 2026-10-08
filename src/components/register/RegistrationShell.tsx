import type { ReactNode } from "react";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { RegistrationExperienceProvider, RegistrationIntro } from "./RegistrationExperience";

export default function RegistrationShell({
  children,
  title = "Register for Ascent",
  description,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <RegistrationExperienceProvider>
    <div className="min-h-screen bg-ascent-canvas">
      <Navbar page="registration" />

      <div id="top" tabIndex={-1} className="pt-16">
        <RegistrationIntro title={title} description={description} />

        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          {children}
        </div>
      </div>

      <Footer compact homeHref="/" />
    </div>
    </RegistrationExperienceProvider>
  );
}
