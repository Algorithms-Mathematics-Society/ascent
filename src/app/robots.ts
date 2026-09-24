import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/content/site";

/**
 * Pages that must stay out of results (registration, entry status, admin) set
 * `robots: { index: false }` in their own metadata. They are deliberately NOT
 * disallowed here: a crawler blocked by robots.txt never fetches the page and
 * so never sees the noindex, which is how blocked URLs end up listed anyway.
 */
export default function robots(): MetadataRoute.Robots {
  const answerEngines = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/admin-page-login", "/_next/"] },
      ...answerEngines.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
