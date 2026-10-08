"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const RegistrationExperience = createContext({
  completed: false,
  setCompleted: (_completed: boolean) => {},
});

export function RegistrationExperienceProvider({ children }: { children: ReactNode }) {
  const [completed, setCompleted] = useState(false);
  return (
    <RegistrationExperience.Provider value={{ completed, setCompleted }}>
      {children}
    </RegistrationExperience.Provider>
  );
}

export function useRegistrationExperience() {
  return useContext(RegistrationExperience);
}

export function RegistrationIntro({ title, description }: { title: string; description?: string }) {
  const { completed } = useRegistrationExperience();
  return (
    <header className="border-b border-ascent-border bg-ascent-surface">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ascent-brand">
            Ascent / Competition entry
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-ascent-ink sm:text-5xl">
            {completed ? "Your Ascent entry" : title}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-6 text-ascent-muted sm:mt-3 sm:text-lg">
            {completed
              ? "Your registration is recorded. Save your reference and see what happens next."
              : description || "Enter Ascent’s C++ competition. Free entry. No account needed."}
          </p>
          {!description && !completed ? (
            <>
              <p className="mt-2 text-sm leading-6 text-ascent-muted">
                Have a shareable Google Drive resume link ready.
              </p>
              <p className="mt-2 text-sm">
                <a className="underline underline-offset-4" href="/register/status">Already registered? Check your entry status.</a>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
