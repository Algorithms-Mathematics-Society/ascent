import { Container } from "@/components/ui";
import { site } from "@/content/site";
import Countdown from "./Countdown";

/**
 * Slim proof + scarcity band directly under the hero. Carries org-level social
 * proof (honestly attributed to the team behind AMS Derive — not claimed as
 * Ascent's own track record) and, when a real registration close date is set,
 * a live countdown. Keeps the navbar clean (scarcity lives here, not there).
 */
export default function CredibilityStrip() {
  const { proof, registration } = site;
  return (
    <section className="border-y border-ascent-border bg-ascent-surface/40">
      <Container className="flex flex-col items-center justify-between gap-6 py-5 md:flex-row">
        {/* Proof — org track record */}
        <div className="flex flex-col items-center gap-x-6 gap-y-2 sm:flex-row">
          <span className="font-mono text-xs uppercase tracking-wider text-ascent-accent">
            {proof.lead}
          </span>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            {proof.stats.map((stat) => (
              <li key={stat.label} className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-ascent-ink">
                  {stat.value}
                </span>
                <span className="text-sm text-ascent-muted">{stat.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Scarcity — only when a real close date is configured */}
        {registration.closeISO ? (
          <Countdown closeISO={registration.closeISO} />
        ) : null}
      </Container>
    </section>
  );
}
