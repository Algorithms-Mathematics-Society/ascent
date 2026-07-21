import RegistrationForm from "@/components/register/RegistrationForm";
import { Button } from "@/components/ui";
import { getRegistrationAvailability } from "@/lib/registrationSettingsData";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { settings, availability } = await getRegistrationAvailability();
  if (!availability.acceptsRegistrations) {
    return (
      <section className="mx-auto max-w-3xl border border-ascent-border bg-ascent-surface" aria-labelledby="registration-unavailable-title">
        <div className="border-b border-ascent-border p-6 sm:p-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">
            Registration status
          </p>
          <h2 id="registration-unavailable-title" className="mt-3 text-2xl font-semibold tracking-tight text-ascent-ink sm:text-3xl">
            New entries are paused.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ascent-muted">
            {availability.message} You do not need to sign in or move to another
            service. If registration reopens, the complete form will appear here.
          </p>
        </div>
        <div className="flex flex-col gap-4 bg-ascent-surface-subtle p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-sm font-semibold text-ascent-ink">
              Existing completed entries are unaffected.
            </p>
            <p className="mt-1 text-xs leading-5 text-ascent-muted">
              {settings.deadline
                ? `Configured deadline: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(settings.deadline))} IST.`
                : "Check the event page for competition updates."}
            </p>
          </div>
          <Button href="/" variant="secondary">Return to event page</Button>
        </div>
      </section>
    );
  }
  return <RegistrationForm />;
}
