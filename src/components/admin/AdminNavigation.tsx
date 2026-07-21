"use client";

import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Registrations" },
  { href: "/admin/activity", label: "Activity" },
] as const;

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex items-center gap-1">
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/registrations/")
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`border px-3 py-2 text-xs font-semibold transition-colors sm:px-4 ${
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
