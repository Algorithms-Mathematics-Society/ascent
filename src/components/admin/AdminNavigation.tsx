"use client";

import { usePathname } from "next/navigation";
import type { AdminRole } from "@/lib/adminSecurity";

const ITEMS = [
  { href: "/admin", label: "Registrations" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/team", label: "Team", ownerOnly: true },
  { href: "/admin/security", label: "Security" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export default function AdminNavigation({ role }: { role: AdminRole }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:flex-none">
      {ITEMS.map((item) => {
        if ("ownerOnly" in item && item.ownerOnly && role !== "OWNER") return null;
        if (item.href === "/admin/settings" && role !== "OWNER") return null;
        const active =
          item.href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/registrations/")
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border px-3 py-2 text-xs font-semibold transition-colors sm:px-4 ${
              active
                ? "border-ascent-ink bg-ascent-ink text-ascent-on-brand"
                : "border-transparent text-ascent-muted hover:border-ascent-border hover:text-ascent-ink"
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
