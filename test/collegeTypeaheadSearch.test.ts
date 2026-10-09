import { afterEach, describe, expect, it, vi } from "vitest";
import { searchColleges } from "@/components/register/CollegeTypeahead";
import { searchEligibleInstitutions } from "@/content/institutions";

describe("local institution picker search", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "IITB",
    "Indian Institute of Technology",
    "BITS Goa",
    "NIT Trichy",
    "  iIt bOmBaY  ",
    "unknown institution",
  ])("preserves the API's ranking and displayed fields for %s", (query) => {
    // The API allows ten results, while the picker has always displayed eight.
    const expected = searchEligibleInstitutions(query, 10)
      .slice(0, 8)
      .map(({ id, canonical_name, campus, tier }) => ({
        college_id: id,
        canonical_name,
        campus,
        tier,
      }));

    expect(searchColleges(query)).toEqual(expected);
  });

  it("returns results synchronously without making a network request", () => {
    const fetch = vi.fn(() => {
      throw new Error("Institution search must not depend on the network.");
    });
    vi.stubGlobal("fetch", fetch);

    expect(searchColleges("IITB")).toContainEqual({
      college_id: "iit-bombay",
      canonical_name: "IIT Bombay",
      campus: null,
      tier: "AUTO_QUALIFY",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps campus aliases and the maximum of eight visible options", () => {
    expect(searchColleges("BITS Goa")[0]).toMatchObject({
      college_id: "bits-pilani-goa",
      canonical_name: "BITS Pilani",
      campus: "Goa campus",
    });
    expect(searchEligibleInstitutions("iit", 40).length).toBeGreaterThan(8);
    expect(searchColleges("iit")).toHaveLength(8);
  });

  it.each(["", " ", "i", "!!!", "An Unlisted College"])(
    "returns no options for %j, allowing the existing unlisted path",
    (query) => {
      expect(searchColleges(query)).toEqual([]);
    },
  );
});
