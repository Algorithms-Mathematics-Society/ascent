import { normalizeResultUsername, parseProblemResult, PROBLEM_IDS, ROUND_ONE_SELECTION_COUNT, type RoundOneResult } from "./results";

/** Handles quoted commas, escaped quotes, CRLF and quoted line breaks. */
function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closedQuote = false;
  const csv = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"') {
        if (csv[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closedQuote = true; }
      } else field += char;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(field); field = ""; closedQuote = false;
      if (char !== ",") {
        if (row.some(value => value !== "")) rows.push(row);
        row = [];
        if (char === "\r" && csv[i + 1] === "\n") i++;
      }
    } else if (char === '"' && field === "" && !closedQuote) quoted = true;
    else {
      if (closedQuote || char === '"') throw new Error("Malformed standings CSV.");
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed standings CSV field.");
  if (field || row.length || closedQuote) { row.push(field); rows.push(row); }
  return rows;
}

export function parseStandings(source: string): Map<string, RoundOneResult> {
  const [headers, ...rows] = parseCsv(source);
  const expected = ["rank", "name", "username", "solved", "partial_credit", "penalty_minutes", ...PROBLEM_IDS];
  if (!headers || headers.length !== expected.length || headers.join(",") !== expected.join(",") || rows.length < ROUND_ONE_SELECTION_COUNT) {
    throw new Error("Standings headers or participant count are invalid.");
  }
  const results = new Map<string, RoundOneResult>();
  for (const [index, fields] of rows.entries()) {
    if (fields.length !== expected.length) throw new Error("Invalid standings row.");
    const [rankText, , usernameText, solvedText, creditText, penaltyText, ...problemFields] = fields;
    const username = normalizeResultUsername(usernameText);
    if (!username || results.has(username)) throw new Error("Invalid or duplicate contest username.");
    if (![rankText, solvedText, penaltyText].every(value => /^\d+$/.test(value)) || !/^\d+(?:\.\d+)?$/.test(creditText)) {
      throw new Error("Invalid standings score.");
    }
    const rank = Number(rankText), solved = Number(solvedText), partialCredit = Number(creditText), penaltyMinutes = Number(penaltyText);
    // The published order is authoritative, including ties at the cutoff.
    if (rank !== index + 1 || solved > PROBLEM_IDS.length || !Number.isSafeInteger(penaltyMinutes) || !Number.isFinite(partialCredit)) {
      throw new Error("Invalid standings rank or score.");
    }
    const problems = PROBLEM_IDS.map((id, i) => parseProblemResult(id, problemFields[i]));
    if (problems.filter(problem => problem.status === "accepted").length !== solved) throw new Error("Solved count does not match problem results.");
    // Names and registration/contact details are deliberately not in this projection.
    results.set(username, { username: usernameText.trim(), rank, selected: rank <= ROUND_ONE_SELECTION_COUNT, solved, partialCredit, penaltyMinutes, problems });
  }
  return results;
}
