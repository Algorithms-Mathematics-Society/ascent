import { describe, it, expect } from "vitest";
import { buildSearchTerms } from "../src/lib/collegeSearch";

describe("buildSearchTerms", () => {
  it("generates prefixes of at least length 2 for each word", () => {
    const terms = buildSearchTerms("IIT Bombay", []);
    expect(terms).toContain("ii");
    expect(terms).toContain("iit");
    expect(terms).toContain("bo");
    expect(terms).toContain("bom");
    expect(terms).toContain("bombay");
  });

  it("includes prefixes from aliases too", () => {
    const terms = buildSearchTerms("Indian Institute of Technology Bombay", [
      "IITB",
      "IIT Bombay",
    ]);
    expect(terms).toContain("iitb");
  });

  it("lowercases everything", () => {
    const terms = buildSearchTerms("BITS Pilani", []);
    expect(terms.every((t) => t === t.toLowerCase())).toBe(true);
  });

  it("does not include single-character prefixes", () => {
    const terms = buildSearchTerms("IIT Bombay", []);
    expect(terms).not.toContain("i");
    expect(terms).not.toContain("b");
  });

  it("deduplicates repeated prefixes across words/aliases", () => {
    const terms = buildSearchTerms("IIT Bombay", ["IIT Bombay"]);
    expect(terms.filter((t) => t === "iit").length).toBe(1);
  });
});
