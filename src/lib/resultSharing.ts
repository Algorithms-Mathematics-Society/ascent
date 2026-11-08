import { SITE_ORIGIN } from "@/content/site";
import type { ResultResponse } from "./results";

export const RESULTS_SHARE_URL = `${SITE_ORIGIN}/results`;
// Only the public landing URL is shared. No username, session, or result in URLs.
export const LINKEDIN_SHARE_URL = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(RESULTS_SHARE_URL)}`;

export function resultCaption({ result, selectionCount }: ResultResponse): string {
  if (!result.selected) return `I took part in Round 1 of Ascent 2026, a C++ competition organised by the Algorithms & Mathematics Society.\n\n${RESULTS_SHARE_URL}\n\n#Ascent2026 #CompetitiveProgramming #CPP`;
  return `I’m through to Round 2 of Ascent 2026!\n\nSelected among the top ${selectionCount}, with a published Round 1 rank of #${result.rank}.\n\nThank you to the Algorithms & Mathematics Society for the challenge. Looking forward to the next round!\n\n${RESULTS_SHARE_URL}\n\n#Ascent2026 #CompetitiveProgramming #CPP`;
}

export function resultCardFilename(rank: number): string {
  return `ascent-2026-round-2-rank-${rank}.png`;
}
