import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ResultsExperience from "@/components/results/ResultsExperience";
import { getRoundOneStandings } from "@/lib/resultsData";
import { ROUND_ONE_ATTENDEES, ROUND_ONE_REGISTRANTS } from "@/content/results";
import { ROUND_ONE_SELECTION_COUNT } from "@/lib/results";

export const metadata: Metadata = {
  title: "Round 1 results | Ascent 2026",
  description: `${ROUND_ONE_REGISTRANTS} registrants. ${ROUND_ONE_ATTENDEES} attended the contest. ${ROUND_ONE_SELECTION_COUNT} selected for Round 2. Check your Ascent result with your AMS Access username.`,
  alternates: { canonical: "/results" },
  openGraph: { title: "Ascent 2026 · Round 1 results", description: "The results are here. Discover your rank and your next chapter.", url: "/results" },
  twitter: { card: "summary_large_image", title: "Ascent 2026 · Round 1 results", description: "The results are here. Discover your rank and your next chapter." },
};

export default async function ResultsPage() {
  await getRoundOneStandings(); // Validate the release data at build time.
  return <><Navbar page="results" /><main id="top" className="ascent-results" tabIndex={-1}><ResultsExperience selectionCount={ROUND_ONE_SELECTION_COUNT} /></main><Footer homeHref="/" /></>;
}
