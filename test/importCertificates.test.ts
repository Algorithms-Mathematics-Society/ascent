import { describe, expect, it } from "vitest";
import {
  buildImportPlan,
  checkReassembled,
  chunkBuffer,
  chunkDocId,
  CHUNK_SIZE,
  cleanName,
  emailHash,
  fileIdForContent,
  fileIdForRank,
  groupsOf,
  maskEmail,
  nameKey,
  parseArgs,
  parseCertificateFilename,
  parseCsv,
  parseOverrides,
  recipientDoc,
  sha256Hex,
  type CertificateFile,
} from "../scripts/import-certificates";

const verifications = [
  { rank: 1, code: "AAAA-1111" },
  { rank: 2, code: "BBBB-2222" },
  { rank: 3, code: "CCCC-3333" },
];

const files: CertificateFile[] = [
  { rank: 1, name: "Arsh Goyal", path: "/x/001 · Arsh Goyal.png" },
  { rank: 2, name: "Meghana Sai", path: "/x/002 · Meghana Sai.png" },
  { rank: 3, name: "Kingshuk Patra", path: "/x/003 · Kingshuk Patra.png" },
];

const csv = [
  "﻿rank,full_name,email,phone",
  "1,arsh goyal,Arsh@Example.com ,123",
  '2,"MEGHANA   SAI",meghana@example.com,456',
  "3,Kingshuk Patra,,789",
].join("\r\n");

const standings = [
  "rank,name,username",
  "1,Arsh Goyal,arsh",
  "2,Meghana Sai,meghana",
  "3,Kingshuk  Patra,kingshuk",
  "4,Someone Else,else",
].join("\n");

function plan(
  overrides?: Map<number, string[]>,
  extra: Partial<Parameters<typeof buildImportPlan>[0]> = {},
) {
  return buildImportPlan({
    files,
    csvSource: csv,
    standingsSource: standings,
    overrides,
    verifications,
    expectedCount: 3,
    ...extra,
  });
}

describe("parseCsv", () => {
  it("handles BOM, quotes, escaped quotes, CRLF and quoted newlines", () => {
    expect(
      parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\n"multi\nline",\n'),
    ).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
      ["multi\nline", ""],
    ]);
  });

  it("rejects malformed quoting", () => {
    expect(() => parseCsv('a,"b')).toThrow(/Unclosed/);
    expect(() => parseCsv('a,"b"c')).toThrow(/Malformed/);
  });
});

describe("filename parsing", () => {
  it("parses NNN · Name.png and collapses whitespace", () => {
    expect(parseCertificateFilename("007 · Ayush  Bothra.png")).toEqual({
      rank: 7,
      name: "Ayush Bothra",
    });
    expect(parseCertificateFilename("133 · Shridhar Sharma.PNG")).toEqual({
      rank: 133,
      name: "Shridhar Sharma",
    });
  });

  it("ignores non-matching files", () => {
    expect(parseCertificateFilename("Page header.png")).toBeNull();
    expect(parseCertificateFilename("12 · Short Rank.png")).toBeNull();
    expect(parseCertificateFilename("012 - Hyphen.png")).toBeNull();
    expect(parseCertificateFilename("012 · Name.jpg")).toBeNull();
    expect(parseCertificateFilename("000 · Zero.png")).toBeNull();
  });
});

describe("names, emails, ids", () => {
  it("compares names case-insensitively after whitespace collapse", () => {
    expect(cleanName("  Arsh \t Goyal ")).toBe("Arsh Goyal");
    expect(nameKey("ARSH  goyal")).toBe(nameKey("Arsh Goyal"));
  });

  it("masks emails without revealing the local part", () => {
    expect(maskEmail("arsh@example.com")).toBe("a***@example.com");
    expect(maskEmail("bad")).toBe("***");
  });

  it("hashes the normalized email with sha256 hex", () => {
    expect(emailHash("a@b.co")).toBe(sha256Hex("a@b.co"));
    expect(emailHash("a@b.co")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("builds file and chunk ids per the contract", () => {
    expect(fileIdForRank(1)).toBe("ascent-2026-r1-001");
    expect(fileIdForRank(133)).toBe("ascent-2026-r1-133");
    expect(fileIdForContent(7, "ab12cd34ef56" + "0".repeat(52))).toBe("ascent-2026-r1-007-ab12cd34ef56");
    expect(chunkDocId("ascent-2026-r1-001", 2)).toBe("ascent-2026-r1-001_2");
  });
});

describe("chunking", () => {
  it("splits into chunks of at most CHUNK_SIZE that reassemble exactly", () => {
    const data = Buffer.alloc(CHUNK_SIZE * 2 + 80_000, 7);
    data[0] = 1;
    data[data.length - 1] = 9;
    const chunks = chunkBuffer(data);
    expect(chunks.map((chunk) => chunk.length)).toEqual([
      CHUNK_SIZE,
      CHUNK_SIZE,
      80_000,
    ]);
    expect(Buffer.concat(chunks).equals(data)).toBe(true);
  });

  it("handles exact multiples and empty input", () => {
    expect(chunkBuffer(Buffer.alloc(CHUNK_SIZE))).toHaveLength(1);
    expect(chunkBuffer(Buffer.alloc(0))).toHaveLength(0);
    expect(() => chunkBuffer(Buffer.alloc(1), 0)).toThrow();
  });

  it("groups items for batching", () => {
    expect(groupsOf([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("recipientDoc chunk_count matches chunkBuffer and checkReassembled accepts the chunks", () => {
    const data = Buffer.from(
      Array.from({ length: 2_500_000 }, (_, i) => i % 251),
    );
    const [entry] = plan();
    const doc = recipientDoc(entry, data);
    const chunks = chunkBuffer(data);
    expect(doc.chunk_count).toBe(chunks.length);
    expect(doc.file_bytes).toBe(data.length);
    expect(doc.file_sha256).toBe(sha256Hex(data));
    expect(checkReassembled(doc, chunks)).toBeNull();
  });

  it("checkReassembled reports missing, short and corrupted chunks", () => {
    const data = Buffer.alloc(2_100_000, 3);
    const doc = {
      file_bytes: data.length,
      file_sha256: sha256Hex(data),
      chunk_count: 3,
    };
    const chunks = chunkBuffer(data);
    expect(checkReassembled(doc, [chunks[0], null, chunks[2]])).toMatch(
      /chunk 1 missing/,
    );
    expect(checkReassembled(doc, chunks.slice(0, 2))).toMatch(
      /expected 3 chunks/,
    );
    const corrupt = Buffer.from(chunks[2]);
    corrupt[0] = 4;
    expect(checkReassembled(doc, [chunks[0], chunks[1], corrupt])).toBe(
      "sha256 mismatch",
    );
    expect(
      checkReassembled(doc, [chunks[0], chunks[1], chunks[2].subarray(1)]),
    ).toMatch(/length/);
  });
});

describe("overrides", () => {
  it("parses rank to email arrays", () => {
    expect(parseOverrides('{ "22": ["a@b.co", "c@d.co"] }')).toEqual(
      new Map([[22, ["a@b.co", "c@d.co"]]]),
    );
  });

  it("rejects bad shapes and out-of-range ranks", () => {
    expect(() => parseOverrides("nope")).toThrow(/valid JSON/);
    expect(() => parseOverrides("[]")).toThrow(/object/);
    expect(() => parseOverrides('{ "0": ["a@b.co"] }')).toThrow(/rank/);
    expect(() => parseOverrides('{ "134": ["a@b.co"] }')).toThrow(/rank/);
    expect(() => parseOverrides('{ "x1": ["a@b.co"] }')).toThrow(/rank/);
    expect(() => parseOverrides('{ "5": "a@b.co" }')).toThrow(/array/);
  });
});

describe("buildImportPlan", () => {
  it("maps ranks, stores the file name as display name and skips empty emails", () => {
    const result = plan();
    expect(result.map((entry) => entry.name)).toEqual([
      "Arsh Goyal",
      "Meghana Sai",
      "Kingshuk Patra",
    ]);
    expect(result[0].emails).toEqual(["arsh@example.com"]);
    expect(result[0].verificationCode).toBe("AAAA-1111");
    expect(result[0].fileId).toBe("ascent-2026-r1-001");
    expect(result[2].emails).toEqual([]);
    expect(result[2].emailSource).toBe("none");
  });

  it("lets overrides replace or fill emails, including several per rank", () => {
    const result = plan(
      new Map([
        [3, ["K@Example.com", "k2@example.com"]],
        [1, ["new@example.com"]],
      ]),
    );
    expect(result[0].emails).toEqual(["new@example.com"]);
    expect(result[0].emailSource).toBe("override");
    expect(result[2].emails).toEqual(["k@example.com", "k2@example.com"]);
  });

  it("aborts on a missing or duplicate file", () => {
    expect(() => plan(undefined, { files: files.slice(0, 2) })).toThrow(
      /Rank 3: expected exactly one certificate file, found 0/,
    );
    expect(() =>
      plan(undefined, {
        files: [...files, { ...files[0], path: "/x/dup.png" }],
      }),
    ).toThrow(/found 2/);
  });

  it("aborts on CSV or standings name mismatch", () => {
    expect(() =>
      plan(undefined, { csvSource: csv.replace("arsh goyal", "Arsh Goel") }),
    ).toThrow(/CSV name/);
    expect(() =>
      plan(undefined, {
        standingsSource: standings.replace("Meghana Sai", "Meghna Sai"),
      }),
    ).toThrow(/standings name/);
  });

  it("aborts on a duplicate email across ranks without printing it", () => {
    let message = "";
    try {
      plan(new Map([[3, ["ARSH@example.com"]]]));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(
      /Duplicate email a\*\*\*@example.com on ranks 1 and 3/,
    );
    expect(message).not.toContain("arsh@example.com");
  });

  it("aborts on an invalid email with only a masked value", () => {
    let message = "";
    try {
      plan(undefined, {
        csvSource: csv.replace("meghana@example.com", "meghana@example"),
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/Rank 2: invalid email m\*\*\*@example/);
    expect(message).not.toContain("meghana@");
  });

  it("aborts when a rank is missing from the CSV or the standings, or lacks a code", () => {
    expect(() =>
      plan(undefined, {
        csvSource: csv.split("\r\n").slice(0, 3).join("\r\n"),
      }),
    ).toThrow(/Rank 3: missing from the qualifier CSV/);
    expect(() =>
      plan(undefined, {
        standingsSource: standings.split("\n").slice(0, 2).join("\n"),
      }),
    ).toThrow(/Rank 2: missing from the standings/);
    expect(() =>
      plan(undefined, { verifications: verifications.slice(0, 2) }),
    ).toThrow(/Rank 3: no verification code/);
  });
});

describe("parseArgs", () => {
  it("defaults to a dry run and reads flags", () => {
    expect(parseArgs([]).commit).toBe(false);
    const options = parseArgs([
      "--commit",
      "--project",
      "demo-x",
      "--verify",
      "--csv",
      "/tmp/a.csv",
    ]);
    expect(options).toMatchObject({
      commit: true,
      verify: true,
      project: "demo-x",
      csv: "/tmp/a.csv",
    });
    expect(() => parseArgs(["--project"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--bogus"])).toThrow(/Unknown/);
  });
});
