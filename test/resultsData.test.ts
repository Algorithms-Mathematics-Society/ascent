import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:fs/promises", () => ({ readFile }));
const csv = readFileSync("leaderboard/standings-ams-ascent-round-1.csv", "utf8");

describe("standings cold-start sharing and recovery", () => {
  beforeEach(() => { vi.resetModules(); readFile.mockReset(); });
  it("coalesces 500 concurrent cold reads into one import and reuses it for warm calls", async () => {
    let resolve!: (source: string) => void;
    readFile.mockReturnValue(new Promise<string>(done => { resolve = done; }));
    const { getRoundOneStandings } = await import("@/lib/resultsData");
    const pending = Array.from({ length: 500 }, () => getRoundOneStandings());
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(pending.every(promise => promise === pending[0])).toBe(true);
    resolve(csv);
    const maps = await Promise.all(pending);
    expect(maps[0].size).toBe(1326);
    expect(maps.every(map => map === maps[0])).toBe(true);
    expect(await getRoundOneStandings()).toBe(maps[0]);
    expect(readFile).toHaveBeenCalledTimes(1);
  });
  it("retries after a temporary file read failure", async () => {
    readFile.mockRejectedValueOnce(new Error("temporary read failure")).mockResolvedValueOnce(csv);
    const { getRoundOneStandings } = await import("@/lib/resultsData");
    await expect(getRoundOneStandings()).rejects.toThrow("temporary read failure");
    expect((await getRoundOneStandings()).size).toBe(1326);
    expect(readFile).toHaveBeenCalledTimes(2);
  });
  it("never retains malformed data as a successful cache entry", async () => {
    readFile.mockResolvedValueOnce("invalid").mockResolvedValueOnce(csv);
    const { getRoundOneStandings } = await import("@/lib/resultsData");
    await expect(getRoundOneStandings()).rejects.toThrow();
    expect((await getRoundOneStandings()).size).toBe(1326);
  });
});
