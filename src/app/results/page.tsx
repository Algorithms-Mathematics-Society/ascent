import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ResultsExperience from "@/components/results/ResultsExperience";
import { getRoundOneStandings } from "@/lib/resultsData";
import { ROUND_ONE_SELECTION_COUNT } from "@/lib/results";

export const metadata: Metadata = {
  title: "Round 1 results | Ascent 2026",
  description: "Your effort. Your next chapter. Check your Ascent Round 1 result and selection for Round 2 using your contest username.",
  alternates: { canonical: "/results" },
  openGraph: { title: "Ascent 2026 · Round 1 results", description: "The results are here. Discover your rank and your next chapter.", url: "/results" },
  twitter: { card: "summary_large_image", title: "Ascent 2026 · Round 1 results", description: "The results are here. Discover your rank and your next chapter." },
};

export default async function ResultsPage() {
  return <><Navbar page="results" /><main id="top" className="ascent-results" tabIndex={-1}><ResultsExperience totalParticipants={(await getRoundOneStandings()).size} selectionCount={ROUND_ONE_SELECTION_COUNT} /></main><Footer homeHref="/" /></>;
}
