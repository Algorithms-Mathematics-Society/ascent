import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseStandings } from "./resultsStandings";
import { normalizeResultUsername, ROUND_ONE_SELECTION_COUNT, type ResultResponse, type RoundOneResult } from "./results";

let standings: Promise<ReadonlyMap<string, RoundOneResult>> | undefined;

export function getRoundOneStandings(): Promise<ReadonlyMap<string, RoundOneResult>> {
  // Concurrent cold requests share one asynchronous read and one parse. Warm
  // requests reuse the map; a failed read/import is retryable, never cached forever.
  standings ??= readFile(join(process.cwd(), "leaderboard/standings-ams-ascent-round-1.csv"), "utf8")
    .then(parseStandings)
    .catch(error => { standings = undefined; throw error; });
  return standings;
}

export async function findRoundOneResult(username: string): Promise<ResultResponse | null> {
  const normalized = normalizeResultUsername(username);
  if (!normalized) return null;
  const entries = await getRoundOneStandings();
  const result = entries.get(normalized);
  return result ? { result, totalParticipants: entries.size, selectionCount: ROUND_ONE_SELECTION_COUNT } : null;
}
