import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PARTICIPATION_NOTICE } from "@/content/legal";
import { SCHEDULE_ISO, TIMELINE } from "@/content/sections";

// The bot check reaches for a third party widget on mount, so it is stubbed
// out here exactly as test/registrationDraft.test.tsx does. Nothing else in
// the form is mocked.
vi.mock("@/components/security/BotCheck", () => ({
  default: () => null,
}));

import RegistrationForm, {
  StageProgress,
  StatusRecoveryNote,
  SuccessReceipt,
  VerificationRequiredNote,
} from "@/components/register/RegistrationForm";

function form() {
  return renderToStaticMarkup(<RegistrationForm initiallyOpen />);
}

const RECEIPT = {
  codeforcesHandle: null,
  reference: "ASC-2026-000123",
  qualificationPath: "AUTO" as const,
  qualificationReason: "Eligible institution",
  college: "Example Institute of Technology",
};

describe("participation consent: the helper text under the checkbox", () => {
  it("no longer claims the consent excludes sponsor sharing", () => {
    const markup = form();

    expect(markup).not.toContain("sponsor sharing");
    expect(markup).not.toContain("competition participation only");
    expect(markup).not.toContain("public profile visibility");
  });

  it("says what the sharing is, since the checkbox label consents to it", () => {
    expect(form()).toContain(
      "shares your registration details and your results with AMS partner firms so they can consider you for roles and internships.",
    );
  });

  it("keeps the one exclusion that is actually true", () => {
    expect(form()).toContain(
      "No public candidate profile is published without your separate permission.",
    );
  });

  it("gives the way to stop it and says stopping costs nothing", () => {
    const markup = form();

    expect(markup).toContain(
      "You can stop future sharing at any time by emailing",
    );
    expect(markup).toContain('href="mailto:team@amshq.in"');
    expect(markup).toContain(
      "Stopping does not affect your entry or your result.",
    );
  });

  it("does not promise that sharing already done can be undone", () => {
    expect(form()).toContain(
      "though a firm cannot be asked to give back what it already holds.",
    );
  });

  it("is announced with the checkbox, not only found by reading on", () => {
    const markup = form();

    expect(markup).toContain('aria-describedby="contest_consent-sharing"');
    expect(markup).toContain('id="contest_consent-sharing"');
  });

  it("leaves the consent wording itself alone, since entries exist under it", () => {
    expect(form()).toContain(PARTICIPATION_NOTICE);
  });
});

describe("stage progress: truthful completed stages", () => {
  it("names the current step without implying a percentage of effort completed", () => {
    for (const step of [1, 2, 3] as const) {
      const markup = renderToStaticMarkup(<StageProgress current={step} onNavigate={() => {}} />);
      expect(markup).toContain(`Step ${step} of 3`);
      expect(markup).not.toContain('role="progressbar"');
      expect(markup).not.toContain("% through the form");
      expect(markup).toContain('aria-current="step"');
      expect((markup.match(/>Completed</g) ?? []).length).toBe(step - 1);
    }
  });

  it("locks backward navigation when an original entry needs recovery", () => {
    const markup = renderToStaticMarkup(<StageProgress current={3} onNavigate={() => {}} disabled />);
    const buttons = markup.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons.every(button => button.includes("disabled"))).toBe(true);
  });
});

describe("submit button: reachable feedback", () => {
  it("is not disabled while the verification token is still missing", () => {
    // Registration is open and no token exists at first render, which is the
    // exact state that used to leave the primary button dead and silent.
    const submit = form().match(/<button type="submit"[^>]*>/);

    expect(submit).not.toBeNull();
    expect(submit![0]).not.toContain("disabled");
  });

  it("does not promise saved answers without a successful draft write", () => {
    const markup = renderToStaticMarkup(<VerificationRequiredNote />);

    expect(markup).toContain("verification check");
    expect(markup).toContain("your entry was not sent");
    expect(markup).toContain("Keep this page open so you do not lose your answers.");
    expect(markup).not.toContain("Your answers are saved");
    expect(markup).toContain('href="mailto:team@amshq.in"');
  });

  it("limits a successful save assurance to the current tab", () => {
    const markup = renderToStaticMarkup(<VerificationRequiredNote draftSaved />);
    expect(markup).toContain("Your answers are saved in this tab.");
    expect(markup).not.toContain("reloading the page will not lose them");
  });
});

describe("a registration that cannot go through points somewhere", () => {
  it("carries the status page and the support address, not a dead field", () => {
    const markup = renderToStaticMarkup(
      <StatusRecoveryNote message="This email is already registered." />,
    );

    expect(markup).toContain("This email is already registered.");
    expect(markup).toContain('href="/register/status"');
    expect(markup).toContain('href="mailto:team@amshq.in"');
  });
});

describe("success receipt: what the candidate needs on the day", () => {
  const markup = renderToStaticMarkup(
    <SuccessReceipt receipt={RECEIPT} email="asha@example.com" />,
  );

  it("names the Round 1 date, taken from the shared content layer", () => {
    expect(markup).toContain(TIMELINE[1].timing);
    expect(markup).toContain("24 October 2026");
    expect(markup).toContain(SCHEDULE_ISO.roundOne);
  });

  it("says Round 1 needs a desktop application, not a phone", () => {
    expect(markup).toContain("AMS Access");
    expect(markup).toContain("proctored desktop application");
    expect(markup).toContain("Windows, macOS and Linux");
    expect(markup).toContain("laptop or a desktop computer");
    expect(markup).toContain("A phone cannot run it.");
  });

  it("says when the application can be downloaded and where to check requirements", () => {
    expect(markup).toContain("15 October 2026");
    expect(markup).toContain('href="https://www.amsaccess.com"');
  });

  it("keeps the existing receipt facts", () => {
    expect(markup).toContain(RECEIPT.reference);
    expect(markup).toContain(RECEIPT.college);
    expect(markup).toContain("/register/status");
  });

  it("distinguishes an accepted direct entry from an entry awaiting review", () => {
    const pending = renderToStaticMarkup(<SuccessReceipt receipt={{ ...RECEIPT, qualificationPath: "QUALIFIER" }} email="asha@example.com" />);
    expect(markup).toContain("You’re registered for Ascent");
    expect(pending).toContain("Your Ascent entry is submitted");
    expect(pending).not.toContain("You’re registered for Ascent");
  });

  it("offers a saved record and useful next step without claiming delivered mail", () => {
    expect(markup).toContain("Copy reference");
    expect(markup).toContain("Save receipt");
    expect(markup).toContain('href="/syllabus"');
    expect(markup).toContain("A confirmation email is queued for");
    expect(markup).not.toContain("A confirmation has been sent");
  });

  it("stays calm: no exclamation marks in the receipt copy", () => {
    const text = markup.replace(/<[^>]*>/g, "");

    expect(text).not.toContain("!");
  });
});
