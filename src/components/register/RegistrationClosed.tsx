import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { TIMELINE } from "@/content/sections";
import { site } from "@/content/site";

// Round 1 copy comes from the timeline so its date is never restated here.
const ROUND_ONE = TIMELINE.find((item) => item.phase.startsWith("Round 1"));

export default function RegistrationClosed() {
  return (
    <section
      className="mx-auto max-w-4xl overflow-hidden rounded-panel border border-ascent-border bg-ascent-surface"
      aria-labelledby="registration-closed-title"
    >
      <div className="grid gap-8 border-b border-ascent-border p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end md:gap-10">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-gold-ink">
            Final count
          </p>
          <p className="mt-3 text-6xl font-semibold leading-none tracking-[-0.04em] text-ascent-brand tabular-nums sm:text-7xl">
            {site.registration.closedCount}
          </p>
          <h2
            id="registration-closed-title"
            className="mt-3 text-lg font-semibold text-ascent-ink"
          >
            registered for Ascent ’26
          </h2>
        </div>
        {ROUND_ONE ? (
          <div className="border-t border-ascent-border pt-6 md:border-l md:border-t-0 md:pl-10 md:pt-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">
              Up next
            </p>
            <p className="mt-3 text-base font-semibold text-ascent-ink">
              {ROUND_ONE.phase}
            </p>
            <p className="mt-1 font-mono text-sm text-ascent-muted">
              {ROUND_ONE.timing}
            </p>
            <p className="mt-3 text-sm leading-6 text-ascent-muted">
              {ROUND_ONE.body}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid md:grid-cols-2">
        <div className="flex flex-col gap-4 border-b border-ascent-border bg-ascent-surface-subtle p-6 sm:p-8 md:border-b-0 md:border-r">
          <div>
            <h3 className="text-base font-semibold text-ascent-ink">
              You registered
            </h3>
            <p className="mt-2 text-sm leading-6 text-ascent-muted">
              Your entry is in. Check your decision, then test your setup on AMS
              Access before Round 1.
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-3">
            <Button href="/register/status">
              Check entry status
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button
              href="https://www.amsaccess.com"
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
            >
              Get AMS Access
              <span className="sr-only"> (opens in a new tab)</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div>
            <h3 className="text-base font-semibold text-ascent-ink">
              You missed the window
            </h3>
            <p className="mt-2 text-sm leading-6 text-ascent-muted">
              Entries for this edition are closed. Join the community to follow
              the rounds and hear first when AMS opens its next contest.
            </p>
          </div>
          <div className="mt-auto">
            <Button
              href={site.community.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
            >
              Join WhatsApp community
              <span className="sr-only"> (opens in a new tab)</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
