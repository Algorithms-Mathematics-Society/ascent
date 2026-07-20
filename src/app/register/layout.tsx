import type { Metadata } from "next";
import type { ReactNode } from "react";
import RegistrationShell from "@/components/register/RegistrationShell";

export const metadata: Metadata = {
  title: "Register | Ascent",
  description: "Register to compete in Ascent.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return <RegistrationShell>{children}</RegistrationShell>;
}
