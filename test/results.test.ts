import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { hasRecordedSubmission, normalizeResultUsername, parseProblemResult } from "@/lib/results";
import { parseStandings } from "@/lib/resultsStandings";

vi.mock("server-only", () => ({}));
import { findRoundOneResult } from "@/lib/resultsData";
import { POST } from "@/app/api/results/route";

const source = readFileSync("leaderboard/standings-ams-ascent-round-1.csv", "utf8");
const standings = [...parseStandings(source).values()];
const header = "rank,name,username,solved,partial_credit,penalty_minutes,A,B,C,D";
function fixture(change?: (fields: string[], index: number) => string[]) {
  return [header, ...Array.from({ length: 134 }, (_, index) => {
    const fields = [String(index + 1), '"Example, ""Participant"""', `person-${index + 1}`, "0", "0.000", "0", "-", "-", "-", "-"];
    return (change ? change(fields, index) : fields).join(",");
  })].join("\r\n");
}

describe("published Round 1 standings", () => {
  it("loads all 1,326 participants and selects exactly the published top 133", () => {
    expect(standings).toHaveLength(1326);
    expect(standings.filter(result => result.selected)).toHaveLength(133);
    expect(standings[0]).toMatchObject({ rank: 1, selected: true, solved: 4, penaltyMinutes: 163 });
    expect(standings[132]).toMatchObject({ rank: 133, selected: true });
    expect(standings[133]).toMatchObject({ rank: 134, selected: false });
    expect(standings[1325]).toMatchObject({ rank: 1326, selected: false });
  });
  it("preserves the supplied ordering when score fields are tied at the selection boundary", () => {
    const tied = [...parseStandings(fixture()).values()];
    expect(tied[132].solved).toBe(tied[133].solved);
    expect(tied[132].partialCredit).toBe(tied[133].partialCredit);
    expect(tied[132].penaltyMinutes).toBe(tied[133].penaltyMinutes);
    expect(tied[132].selected).toBe(true);
    expect(tied[133].selected).toBe(false);
  });
  it("distinguishes submission records from listed accounts without treating zero credit as absence", () => {
    expect(standings.filter(hasRecordedSubmission)).toHaveLength(161);
    expect(standings.filter(entry => !hasRecordedSubmission(entry))).toHaveLength(1165);
    expect(hasRecordedSubmission(standings[203])).toBe(false);
    expect(standings.filter(entry => entry.solved > 0).map(entry => entry.rank)).toEqual(Array.from({ length: 133 }, (_, i) => i + 1));
    const zeroCredit = standings.find(entry => entry.solved === 0 && entry.partialCredit === 0 && entry.problems.some(problem => problem.attempts > 0));
    expect(zeroCredit).toBeDefined();
    expect(hasRecordedSubmission(zeroCredit!)).toBe(true);
  });
  it("matches whole usernames case-insensitively with surrounding whitespace ignored", async () => {
    expect((await findRoundOneResult(`  ${standings[0].username.toUpperCase()}  `))?.result.rank).toBe(1);
    expect(await findRoundOneResult("definitely-not-a-contest-participant")).toBeNull();
    expect(await findRoundOneResult(standings[0].username.slice(0, 3))).toBeNull();
  });
  it("does not expose real names or contact details in the result projection", () => {
    expect(Object.keys(standings[0]).sort()).toEqual(["username", "rank", "selected", "solved", "partialCredit", "penaltyMinutes", "problems"].sort());
  });
  it("handles CSV quoting, CRLF, BOM and quoted newlines", () => {
    expect(parseStandings(`\uFEFF${fixture().replace('"Example, ""Participant"""', '"Example\nParticipant"')}\r\n`).size).toBe(134);
  });
  it("rejects duplicate usernames instead of silently showing another participant's result", () => {
    expect(() => parseStandings(fixture((fields, i) => { if (i === 1) fields[2] = "PERSON-1"; return fields; }))).toThrow(/duplicate/);
  });
  it.each([
    ["missing rank", 0, "2"], ["negative score", 4, "-1"], ["non-numeric score", 4, "NaN"],
    ["solved mismatch", 3, "1"], ["invalid problem", 6, "invalid"],
  ])("rejects %s", (_, column, value) => {
    expect(() => parseStandings(fixture((fields, i) => { if (i === 0) fields[Number(column)] = String(value); return fields; }))).toThrow();
  });
  it("rejects truncated or malformed exports", () => {
    expect(() => parseStandings(source.split("\n").slice(0, 100).join("\n"))).toThrow();
    expect(() => parseStandings(fixture() + '\n"unclosed')).toThrow();
    expect(() => parseStandings(fixture().replace(header, "wrong,headers"))).toThrow();
  });
});

describe("result input and problem notation", () => {
  it.each([null, {}, [], 123, "", "  ", "some user", "user\nname", "x".repeat(129)])("rejects invalid username %j", value => {
    expect(normalizeResultUsername(value)).toBeNull();
  });
  it("decodes accepted, partial, zero-credit and unattempted problems separately", () => {
    expect(parseProblemResult("A", "AC@65m/2")).toEqual({ id: "A", status: "accepted", credit: 100, minutes: 65, attempts: 2 });
    expect(parseProblemResult("B", "12.5%/3")).toMatchObject({ status: "partial", credit: 12.5, attempts: 3 });
    expect(parseProblemResult("C", "0%/1")).toMatchObject({ status: "partial", credit: 0, attempts: 1 });
    expect(parseProblemResult("D", "-")).toMatchObject({ status: "unattempted", attempts: 0 });
    expect(() => parseProblemResult("A", "101%/1")).toThrow();
    expect(() => parseProblemResult("A", "AC@9999999999999999999m/1")).toThrow();
    expect(() => parseProblemResult("A", "25%/9999999999999999999")).toThrow();
  });
});

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://ascent.amshq.in/api/results", {
    method: "POST", headers: { origin: "https://ascent.amshq.in", "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  });
}

describe("result lookup endpoint", () => {
  it("returns only the requested result, with no-store and noindex headers", async () => {
    const response = await POST(request({ username: standings[132].username }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const body = await response.json();
    expect(body).toMatchObject({ totalParticipants: 1326, selectionCount: 133, result: { rank: 133, selected: true } });
    expect(Object.keys(body)).toEqual(["result", "totalParticipants", "selectionCount"]);
  });
  it("does not select rank 134", async () => {
    const response = await POST(request({ username: standings[133].username }));
    expect((await response.json()).result.selected).toBe(false);
  });
  it("returns not found without suggestions or other participants", async () => {
    const response = await POST(request({ username: "unknown-contest-username" }));
    expect(response.status).toBe(404);
    expect(Object.keys(await response.json())).toEqual(["error"]);
  });
  it.each([null, [], { username: {} }, { username: "" }])("rejects invalid payload %j", async payload => {
    expect((await POST(request(payload))).status).toBe(400);
  });
  it("rejects cross-origin, oversized and malformed requests", async () => {
    expect((await POST(request({ username: "test" }, { origin: "https://other.example" }))).status).toBe(403);
    expect((await POST(request({ username: "test" }, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(request({ username: "x".repeat(2000) }))).status).toBe(413);
    expect((await POST(new Request("https://ascent.amshq.in/api/results", { method: "POST", headers: { origin: "https://ascent.amshq.in", "content-type": "application/json" }, body: "{" }))).status).toBe(400);
  });
});
