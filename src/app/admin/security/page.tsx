import type { Metadata } from "next";
import AdminMfaEnrollment from "@/components/admin/AdminMfaEnrollment";
import { requireAdminSession } from "@/lib/adminAuth";
import { adminAuth } from "@/lib/firebaseAdmin";

export const metadata: Metadata = {
  title: "Security · Ascent admin",
};

function formatEnrollmentTime(value?: string) {
  if (!value) return "Enrollment time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Enrollment time unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export default async function AdminSecurityPage() {
  const session = await requireAdminSession();
  const user = await adminAuth.getUser(session.uid);
  const factors = user.multiFactor?.enrolledFactors ?? [];
  const totpFactors = factors.filter((factor) => factor.factorId === "totp");
  const enrolled = totpFactors.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="border-b border-ascent-border pb-7">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">
          Account protection
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ascent-ink sm:text-4xl">
          Admin security
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ascent-muted">
          Pair a time-based authenticator with this account. Passwords establish identity;
          the rotating code proves possession of a separate device.
        </p>
      </header>

      <section
        className={`mt-6 border p-5 sm:p-6 ${
          enrolled
            ? "border-ascent-success bg-ascent-success-tint"
            : "border-ascent-danger bg-ascent-danger-tint"
        }`}
        aria-labelledby="mfa-status-title"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={`font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] ${enrolled ? "text-ascent-success" : "text-ascent-danger"}`}>
              {enrolled ? "Protected" : "Action required"}
            </p>
            <h2 id="mfa-status-title" className="mt-2 text-xl font-semibold tracking-tight text-ascent-ink">
              {enrolled ? "Authenticator is enrolled" : "Authenticator is not enrolled"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ascent-muted">
              {enrolled
                ? "Fresh sign-ins now require the rotating code after the account password. Server-wide enforcement will be activated only after every owner passes the recovery drill."
                : "Complete the two short stages below. Nothing is stored until a valid code proves that your authenticator is paired correctly."}
            </p>
          </div>
          <span className={`shrink-0 border px-3 py-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${enrolled ? "border-ascent-success text-ascent-success" : "border-ascent-danger text-ascent-danger"}`}>
            {enrolled ? `${totpFactors.length} TOTP factor${totpFactors.length === 1 ? "" : "s"}` : "0 factors"}
          </span>
        </div>
      </section>

      <section className="mt-6 border border-ascent-border bg-ascent-surface" aria-labelledby="mfa-setup-title">
        <header className="border-b border-ascent-border p-5 sm:p-6">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
            Time-based one-time password
          </p>
          <h2 id="mfa-setup-title" className="mt-2 text-xl font-semibold tracking-tight text-ascent-ink">
            {enrolled ? "Enrollment record" : "Pair an authenticator"}
          </h2>
        </header>
        <div className="p-5 sm:p-6">
          {enrolled ? (
            <div className="grid gap-4">
              {totpFactors.map((factor, index) => (
                <dl key={factor.uid} className="grid gap-px border border-ascent-border bg-ascent-border sm:grid-cols-3">
                  <div className="bg-ascent-surface-subtle p-4">
                    <dt className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ascent-muted">Method</dt>
                    <dd className="mt-1 text-sm font-semibold text-ascent-ink">Authenticator app</dd>
                  </div>
                  <div className="bg-ascent-surface-subtle p-4">
                    <dt className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ascent-muted">Label</dt>
                    <dd className="mt-1 text-sm font-semibold text-ascent-ink">{factor.displayName || `Authenticator ${index + 1}`}</dd>
                  </div>
                  <div className="bg-ascent-surface-subtle p-4">
                    <dt className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ascent-muted">Enrolled</dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums text-ascent-ink">{formatEnrollmentTime(factor.enrollmentTime)} IST</dd>
                  </div>
                </dl>
              ))}
              <p className="border-l-2 border-ascent-brand pl-4 text-xs leading-5 text-ascent-muted">
                Self-service removal is deliberately unavailable. An owner should first verify the
                other recovery account, then use the audited recovery procedure in Block 3.
              </p>
            </div>
          ) : (
            <AdminMfaEnrollment email={session.email} />
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-px border border-ascent-border bg-ascent-border sm:grid-cols-3" aria-label="MFA safety model">
        {[
          ["01", "Separate device", "Prefer an authenticator on a device that is not your daily admin browser."],
          ["02", "No screenshot", "Do not save or message the QR code or manual key after pairing."],
          ["03", "Recovery first", "Keep the second owner independent before mandatory enforcement is switched on."],
        ].map(([number, title, detail]) => (
          <article key={number} className="bg-ascent-surface p-5">
            <p className="font-mono text-[0.6rem] font-semibold text-ascent-brand">{number}</p>
            <h3 className="mt-2 text-sm font-semibold text-ascent-ink">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-ascent-muted">{detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
