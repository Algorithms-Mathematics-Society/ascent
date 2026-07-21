import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { getAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in · Ascent",
  robots: { index: false, follow: false },
};

export default async function AdminPageLogin() {
  if (await getAdminSession()) redirect("/admin");

  return (
    <div className="min-h-screen bg-ascent-canvas">
      <header className="h-16 border-b border-ascent-border bg-ascent-surface">
        <nav
          aria-label="Admin login navigation"
          className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"
        >
          <a
            href="/"
            aria-label="Ascent home"
            className="flex min-h-11 items-center gap-2 font-mono text-sm font-bold tracking-tight text-ascent-ink hover:text-ascent-brand"
          >
            <Image
              src="/ascent-logo.svg"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8"
            />
            <span>Ascent</span>
          </a>
          <a
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ascent-brand underline underline-offset-4 hover:text-ascent-ink"
          >
            Return to event
          </a>
        </nav>
      </header>

      <main
        id="top"
        className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8"
      >
        <section
          aria-labelledby="admin-login-title"
          className="w-full border border-ascent-border bg-ascent-surface lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]"
        >
          <aside className="border-b border-ascent-border bg-ascent-brand p-6 text-ascent-on-brand sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-on-brand/80">
              Ascent operations
            </p>
            <h2 className="mt-3 max-w-sm text-3xl font-semibold tracking-tight">
              Administrative access.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-ascent-on-brand/80">
              Sign in to manage competition operations and registration review.
            </p>
            <div className="mt-10 hidden border-t border-ascent-on-brand/25 pt-4 lg:block">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-ascent-on-brand/70">
                Restricted area · authorized staff only
              </p>
            </div>
          </aside>

          <div className="p-6 sm:p-8 lg:p-10">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">
              Restricted access
            </p>
            <h1
              id="admin-login-title"
              className="mt-3 text-3xl font-semibold tracking-tight text-ascent-ink sm:text-4xl"
            >
              Admin sign in
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-ascent-muted">
              Use your assigned administrator email and password. Enrolled accounts
              complete one authenticator check before access is issued.
            </p>
            <AdminLoginForm />
          </div>
        </section>
      </main>
    </div>
  );
}
