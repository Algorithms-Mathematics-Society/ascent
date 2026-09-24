import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/content/site";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/content/legal";

/** Indexable pages only. Registration, entry status and admin are noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date("2026-09-24T06:00:00+05:30");
  return [
    { url: `${SITE_ORIGIN}/`, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_ORIGIN}/syllabus`, lastModified: updated, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_ORIGIN}/privacy`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_ORIGIN}/privacy/${PRIVACY_VERSION}`, lastModified: updated, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_ORIGIN}/terms`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_ORIGIN}/terms/${TERMS_VERSION}`, lastModified: updated, changeFrequency: "yearly", priority: 0.2 },
  ];
}
