import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isResultResponse, type ResultResponse } from "@/lib/results";
import { parseStandings } from "@/lib/resultsStandings";
import { LINKEDIN_SHARE_URL, RESULTS_SHARE_URL, resultCaption, resultCardFilename } from "@/lib/resultSharing";

const entries = [...parseStandings(readFileSync("leaderboard/standings-ams-ascent-round-1.csv", "utf8")).values()];
const response = (index: number): ResultResponse => ({ result: structuredClone(entries[index]), totalParticipants: entries.length, selectionCount: 133 });

describe("share content", () => {
  it("includes the correct rank and selection in the participant-controlled caption", () => {
    const caption = resultCaption(response(132));
    expect(caption).toContain("#133 out of 1,326");
    expect(caption).toContain("through to Round 2");
    expect(caption).toContain("top 133");
    expect(caption).not.toContain(entries[132].username);
    expect(caption.length).toBeLessThan(3000);
  });
  it("never claims selection for an unselected participant", () => {
    expect(resultCaption(response(133))).not.toContain("through to Round 2");
  });
  it("shares only a fixed public landing URL, never participant data or local URLs", () => {
    const link = new URL(LINKEDIN_SHARE_URL);
    expect(link.origin).toBe("https://www.linkedin.com");
    expect([...link.searchParams.keys()]).toEqual(["url"]);
    expect(link.searchParams.get("url")).toBe("https://ascent.amshq.in/results");
    expect(RESULTS_SHARE_URL).toBe("https://ascent.amshq.in/results");
    expect(resultCardFilename(133)).toBe("ascent-2026-round-2-rank-133.png");
  });
});

describe("result response validation", () => {
  it("accepts every published result", () => {
    expect(entries.every((_, i) => isResultResponse(response(i)))).toBe(true);
  });
  it("rejects malformed scores and a selected flag that disagrees with the rank", () => {
    const wrongSelection = response(133); wrongSelection.result.selected = true;
    expect(isResultResponse(wrongSelection)).toBe(false);
    const invalidNumber = response(0); invalidNumber.result.partialCredit = Number.NaN;
    expect(isResultResponse(invalidNumber)).toBe(false);
    const missingScore = response(0); delete (missingScore.result as Partial<typeof missingScore.result>).partialCredit;
    expect(isResultResponse(missingScore)).toBe(false);
    const wrongProblems = response(0); wrongProblems.result.problems.reverse();
    expect(isResultResponse(wrongProblems)).toBe(false);
    expect(isResultResponse({ result: {} })).toBe(false);
    expect(isResultResponse(null)).toBe(false);
    const staleCutoff = response(0); staleCutoff.selectionCount = 150;
    expect(isResultResponse(staleCutoff)).toBe(false);
  });
});
