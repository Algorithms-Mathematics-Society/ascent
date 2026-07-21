import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import AdminNavigation from "@/components/admin/AdminNavigation";
import { requireAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Ascent",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();

  return (
    <div className="min-h-screen bg-ascent-canvas text-ascent-ink">
      <header className="border-b border-ascent-border bg-ascent-surface">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <a href="/admin" aria-label="Ascent admin home" className="shrink-0">
              <Image
                src="/ascent-logo.svg"
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8"
              />
            </a>
            <div className="min-w-0 border-l border-ascent-border pl-3">
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ascent-brand">
                Ascent admin
              </p>
              <p className="hidden truncate text-sm text-ascent-muted md:block">{session.email}</p>
              <p className="hidden font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-ascent-muted md:block">
                {session.role === "OWNER" ? "Owner" : "Reviewer"}
              </p>
            </div>
          </div>
          <div className="order-3 flex w-full items-center justify-between gap-3 border-t border-ascent-border pt-3 sm:order-none sm:w-auto sm:border-0 sm:pt-0">
            <AdminNavigation role={session.role} />
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
