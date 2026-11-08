export const ROUND_ONE_SELECTION_COUNT = 133;
export const PROBLEM_IDS = ["A", "B", "C", "D"] as const;

export type ProblemResult = {
  id: typeof PROBLEM_IDS[number];
  status: "accepted" | "partial" | "unattempted";
  credit: number;
  minutes: number | null;
  attempts: number;
};

export type RoundOneResult = {
  username: string;
  rank: number;
  selected: boolean;
  solved: number;
  partialCredit: number;
  penaltyMinutes: number;
  problems: ProblemResult[];
};

export type ResultResponse = {
  result: RoundOneResult;
  totalParticipants: number;
  selectionCount: number;
};

/** Submission evidence, not attendance: zero-credit attempts still count. */
export function hasRecordedSubmission(result: Pick<RoundOneResult, "problems">): boolean {
  return result.problems.some(problem => problem.attempts > 0);
}

export function normalizeResultUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim().toLowerCase();
  return username.length > 0 && username.length <= 128 && !/[\s\x00-\x1f\x7f]/.test(username)
    ? username : null;
}

export function parseProblemResult(id: ProblemResult["id"], value: string): ProblemResult {
  if (value === "-") return { id, status: "unattempted", credit: 0, minutes: null, attempts: 0 };
  const accepted = /^AC@(\d+)m\/([1-9]\d*)$/.exec(value);
  if (accepted && Number.isSafeInteger(Number(accepted[1])) && Number.isSafeInteger(Number(accepted[2]))) return { id, status: "accepted", credit: 100, minutes: Number(accepted[1]), attempts: Number(accepted[2]) };
  const partial = /^(\d+(?:\.\d+)?)%\/([1-9]\d*)$/.exec(value);
  if (partial && Number(partial[1]) <= 100 && Number.isSafeInteger(Number(partial[2]))) {
    return { id, status: "partial", credit: Number(partial[1]), minutes: null, attempts: Number(partial[2]) };
  }
  throw new Error(`Invalid problem result for ${id}.`);
}

/** Fail closed before rendering a malformed or inconsistent lookup response. */
export function isResultResponse(value: unknown): value is ResultResponse {
  const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
  const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
  if (!record(value) || !record(value.result) || !integer(value.totalParticipants, ROUND_ONE_SELECTION_COUNT) || value.selectionCount !== ROUND_ONE_SELECTION_COUNT) return false;
  const r = value.result;
  if (!normalizeResultUsername(r.username) || !integer(r.rank, 1, value.totalParticipants) || r.selected !== (r.rank <= value.selectionCount) ||
    !integer(r.solved, 0, 4) || typeof r.partialCredit !== "number" || !Number.isFinite(r.partialCredit) || r.partialCredit < 0 ||
    !integer(r.penaltyMinutes, 0) || !Array.isArray(r.problems) || r.problems.length !== 4) return false;
  let solved = 0;
  for (const [i, p] of r.problems.entries()) {
    if (!record(p) || p.id !== PROBLEM_IDS[i]) return false;
    if (p.status === "accepted") {
      if (p.credit !== 100 || !integer(p.minutes, 0) || !integer(p.attempts, 1)) return false;
      solved++;
    } else if (p.status === "partial") {
      if (typeof p.credit !== "number" || !Number.isFinite(p.credit) || p.credit < 0 || p.credit > 100 || p.minutes !== null || !integer(p.attempts, 1)) return false;
    } else if (p.status !== "unattempted" || p.credit !== 0 || p.minutes !== null || p.attempts !== 0) return false;
  }
  return r.solved === solved;
}
