import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>();
  const snap = (path: string) => {
    const value = store.get(path);
    return {
      exists: value !== undefined,
      id: path.split("/").pop(),
      data: () => (value ? { ...value } : undefined),
    };
  };
  // Refs carry their path plus get/set for non-transactional reads and writes.
  const ref = (path: string) => ({
    path,
    get: async () => snap(path),
    set: async (data: Record<string, unknown>) => {
      store.set(path, { ...data });
    },
  });
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ref(`${name}/${id}`),
    }),
    getAll: async (...refs: { path: string }[]) =>
      refs.map((r) => snap(r.path)),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
      fn({
        get: async (r: { path: string }) => snap(r.path),
        getAll: async (...refs: { path: string }[]) =>
          refs.map((r) => snap(r.path)),
        set: (r: { path: string }, data: Record<string, unknown>) => {
          store.set(r.path, { ...data });
        },
        create: (r: { path: string }, data: Record<string, unknown>) => {
          store.set(r.path, { ...data });
        },
        update: (r: { path: string }, data: Record<string, unknown>) => {
          store.set(r.path, { ...store.get(r.path), ...data });
        },
        delete: (r: { path: string }) => {
          store.delete(r.path);
        },
      }),
  };
  return {
    store,
    db,
    pending: [] as Promise<unknown>[],
    verifyBot: vi.fn(),
    send: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebaseAdmin", () => ({ adminDb: mocks.db }));
vi.mock("@vercel/functions", () => ({
  waitUntil: (promise: Promise<unknown>) => {
    mocks.pending.push(promise);
  },
}));
vi.mock("@/lib/botProtection", () => ({
  verifyBot: mocks.verifyBot,
  clientIp: (request: Request) =>
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
}));
vi.mock("@/lib/email/resend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/email/resend")>()),
  sendResendEmail: mocks.send,
}));

import {
  CERTIFICATE_COOKIE,
  CERTIFICATE_SESSION_TTL_SECONDS,
  certificateCodeMatches,
  hashCertificateCode,
  normalizeCertificateCode,
  signCertificateSession,
  verifyCertificateSession,
} from "../src/lib/certificates/tokens";
import {
  assembleCertificateFile,
  certificateFilename,
  certificateNameSlug,
  chunkBytes,
  CertificateIntegrityError,
  parseRecipient,
} from "../src/lib/certificates/data";
import { POST as requestCode } from "../src/app/api/certificates/code/route";
import { POST as verifyCode } from "../src/app/api/certificates/verify/route";
import { GET as me } from "../src/app/api/certificates/me/route";
import { GET as download } from "../src/app/api/certificates/download/route";
import { DELETE as signOut } from "../src/app/api/certificates/session/route";

const EMAIL = "qualifier@example.test";
const emailHash = createHash("sha256").update(EMAIL).digest("hex");
const FILE = Buffer.from("PNG-bytes-for-a-test-certificate-0123456789");
const recipientDoc = {
  edition: "ascent-2026",
  round: 1,
  rank: 7,
  name: "Kushal Kumar Putti",
  verification_code: "5JHT-G97D",
  file_id: "ascent-2026-r1-007",
  file_bytes: FILE.byteLength,
  file_sha256: createHash("sha256").update(FILE).digest("hex"),
  chunk_count: 2,
  content_type: "image/png",
};

function seedRecipient() {
  mocks.store.set(`certificate_recipients/${emailHash}`, { ...recipientDoc });
  mocks.store.set("certificate_file_chunks/ascent-2026-r1-007_0", {
    file_id: "ascent-2026-r1-007",
    index: 0,
    data: FILE.subarray(0, 20),
  });
  mocks.store.set("certificate_file_chunks/ascent-2026-r1-007_1", {
    file_id: "ascent-2026-r1-007",
    index: 1,
    data: new Uint8Array(FILE.subarray(20)),
  });
}
function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`https://ascent.test${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      origin: "https://ascent.test",
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.9",
      ...headers,
    },
  });
}
function get(path: string, cookie?: string) {
  return new NextRequest(`https://ascent.test${path}`, {
    headers: cookie ? { cookie: `${CERTIFICATE_COOKIE}=${cookie}` } : {},
  });
}
async function flush() {
  await Promise.all(mocks.pending.splice(0));
}
function storeCode(code: string, extra: Record<string, unknown> = {}) {
  mocks.store.set(`certificate_codes/${emailHash}`, {
    code_hash: hashCertificateCode(emailHash, code),
    expires_at: Date.now() + 600000,
    attempts: 0,
    created_at: Date.now(),
    ...extra,
  });
}

beforeEach(() => {
  mocks.store.clear();
  mocks.pending.length = 0;
  vi.resetAllMocks();
  mocks.verifyBot.mockResolvedValue({ ok: true });
  mocks.send.mockResolvedValue("email-id");
  vi.stubEnv(
    "CANDIDATE_STATUS_SECRET",
    "test-only-status-secret-with-at-least-32-characters",
  );
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("RESEND_FROM_EMAIL", "Ascent <team@amshq.in>");
  vi.stubEnv("SITE_URL", "https://ascent.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("certificate session tokens", () => {
  it("round-trips and rejects wrong purpose, tampering and expiry", () => {
    const now = Date.now();
    const { token, claims } = signCertificateSession(emailHash, now);
    expect(verifyCertificateSession(token, now)).toEqual(claims);
    expect(
      verifyCertificateSession(
        token,
        now + CERTIFICATE_SESSION_TTL_SECONDS * 1000,
      ),
    ).toBeNull();
    const [body, signature] = token.split(".");
    for (const bad of [
      null,
      "",
      `${body}.bad`,
      `A${body.slice(1)}.${signature}`,
      `${token}.x`,
      "x".repeat(1001),
    ]) {
      expect(verifyCertificateSession(bad, now)).toBeNull();
    }
    const forged = Buffer.from(
      JSON.stringify({ ...claims, purpose: "session" }),
    ).toString("base64url");
    expect(verifyCertificateSession(`${forged}.${signature}`, now)).toBeNull();
  });
  it("uses a key derived for certificates, not the raw status secret", async () => {
    const { signStatusToken, verifyStatusToken } =
      await import("../src/lib/candidate/tokens");
    const { token } = signCertificateSession(emailHash);
    expect(verifyStatusToken(token, "session")).toBeNull();
    expect(
      verifyCertificateSession(
        signStatusToken("session", "student", emailHash).token,
      ),
    ).toBeNull();
  });
  it("fails closed without a secret", () => {
    const { token } = signCertificateSession(emailHash);
    vi.stubEnv("CANDIDATE_STATUS_SECRET", "short");
    expect(verifyCertificateSession(token)).toBeNull();
    expect(() => signCertificateSession(emailHash)).toThrow();
  });
});

describe("certificate code hashing", () => {
  it("matches only the same email and code", () => {
    const stored = hashCertificateCode(emailHash, "012345");
    expect(certificateCodeMatches(stored, emailHash, "012345")).toBe(true);
    expect(certificateCodeMatches(stored, emailHash, "012346")).toBe(false);
    expect(certificateCodeMatches(stored, "b".repeat(64), "012345")).toBe(
      false,
    );
    expect(certificateCodeMatches("short", emailHash, "012345")).toBe(false);
    expect(certificateCodeMatches(undefined, emailHash, "012345")).toBe(false);
  });
  it("normalizes six-digit codes only", () => {
    expect(normalizeCertificateCode(" 012 345 ")).toBe("012345");
    for (const bad of ["12345", "1234567", "abcdef", 123456, null])
      expect(normalizeCertificateCode(bad)).toBeNull();
  });
});

describe("certificate filenames", () => {
  it("slugs names to ASCII and is never empty", () => {
    expect(certificateFilename("Kushal Kumar Putti")).toBe(
      "Ascent-26-Round-1-Certificate-Kushal-Kumar-Putti.png",
    );
    expect(certificateNameSlug("  José  Ñúñez-O'Brien ")).toBe(
      "Jose-Nunez-O-Brien",
    );
    expect(certificateNameSlug("आरव")).toBe("Participant");
    expect(certificateNameSlug("---")).toBe("Participant");
    expect(certificateNameSlug('a"; filename=evil.exe\r\n')).toBe(
      "a-filename-evil-exe",
    );
    expect(certificateNameSlug("x".repeat(300))).toHaveLength(80);
  });
});

describe("certificate file assembly", () => {
  const recipient = parseRecipient(recipientDoc)!;
  const chunk = (index: number, data: unknown) => ({
    exists: true,
    data: () => ({ file_id: recipient.fileId, index, data }),
  });
  it("accepts Buffer, Uint8Array and Bytes-like chunk data", () => {
    const bytesLike = { toUint8Array: () => new Uint8Array(FILE.subarray(20)) };
    expect(
      assembleCertificateFile(recipient, [
        chunk(0, FILE.subarray(0, 20)),
        chunk(1, bytesLike),
      ]).equals(FILE),
    ).toBe(true);
    expect(chunkBytes("not bytes")).toBeNull();
  });
  it("detects sha256, length, ordering and missing chunk mismatches", () => {
    const tampered = Buffer.from(FILE.subarray(20));
    tampered[0] ^= 1;
    const cases = [
      [[chunk(0, FILE.subarray(0, 20)), chunk(1, tampered)], "sha256"],
      [[chunk(0, FILE.subarray(0, 20)), chunk(1, FILE.subarray(21))], "length"],
      [
        [chunk(1, FILE.subarray(20)), chunk(0, FILE.subarray(0, 20))],
        "chunk_missing",
      ],
      [
        [
          chunk(0, FILE.subarray(0, 20)),
          { exists: false, data: () => undefined },
        ],
        "chunk_missing",
      ],
      [[chunk(0, FILE)], "chunk_count"],
    ] as const;
    for (const [chunks, reason] of cases) {
      expect(() => assembleCertificateFile(recipient, chunks as never)).toThrow(
        CertificateIntegrityError,
      );
      try {
        assembleCertificateFile(recipient, chunks as never);
      } catch (error) {
        expect((error as CertificateIntegrityError).reason).toBe(reason);
      }
    }
  });
  it("rejects malformed recipient documents", () => {
    expect(parseRecipient({ ...recipientDoc, round: 2 })).toBeNull();
    expect(parseRecipient({ ...recipientDoc, chunk_count: 0 })).toBeNull();
    expect(parseRecipient({ ...recipientDoc, file_id: "../x" })).toBeNull();
  });
});

describe("POST /api/certificates/code", () => {
  it("returns an identical 202 for known and unknown emails and only emails the known one", async () => {
    seedRecipient();
    const known = await requestCode(
      post("/api/certificates/code", {
        email: EMAIL.toUpperCase(),
        botToken: "t",
      }),
    );
    const unknown = await requestCode(
      post("/api/certificates/code", {
        email: "stranger@example.test",
        botToken: "t",
      }),
    );
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.json()).toEqual(await unknown.json());
    expect(known.headers.get("cache-control")).toBe("private, no-store");
    await flush();
    expect(mocks.send).toHaveBeenCalledOnce();
    const [, payload, key] = mocks.send.mock.calls[0];
    const code = payload.subject.match(/(\d{6})$/)[1];
    expect(payload.to).toBe(EMAIL);
    expect(payload.text).toContain("It expires in 10 minutes.");
    expect(payload.text).toContain("https://ascent.test/certificate");
    expect(key).toMatch(
      new RegExp(`^ascent-2026/certificate-code/${emailHash}/`),
    );
    const stored = mocks.store.get(`certificate_codes/${emailHash}`)!;
    expect(stored.attempts).toBe(0);
    expect(stored.code_hash).not.toContain(code);
    expect(certificateCodeMatches(stored.code_hash, emailHash, code)).toBe(
      true,
    );
    expect(
      [...mocks.store.keys()].some(
        (k) => k.startsWith("certificate_codes/") && !k.endsWith(emailHash),
      ),
    ).toBe(false);
  });
  it("swallows delivery failures after the response", async () => {
    seedRecipient();
    mocks.send.mockRejectedValue(new Error("provider_timeout"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      (
        await requestCode(
          post("/api/certificates/code", { email: EMAIL, botToken: "t" }),
        )
      ).status,
    ).toBe(202);
    await expect(flush()).resolves.toBeUndefined();
    expect(error.mock.calls.flat().join(" ")).not.toContain(EMAIL);
    error.mockRestore();
  });
  it("still answers 202 over the per-email limit without sending more", async () => {
    seedRecipient();
    for (let i = 0; i < 6; i++)
      expect(
        (
          await requestCode(
            post("/api/certificates/code", { email: EMAIL, botToken: "t" }),
          )
        ).status,
      ).toBe(202);
    await flush();
    expect(mocks.send).toHaveBeenCalledTimes(5);
  });
  it("validates origin, email, bot check and configuration", async () => {
    expect(
      (
        await requestCode(
          post(
            "/api/certificates/code",
            { email: EMAIL },
            { origin: "https://evil.test" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await requestCode(
          post("/api/certificates/code", { email: "nope", botToken: "t" }),
        )
      ).status,
    ).toBe(400);
    mocks.verifyBot.mockResolvedValueOnce({
      ok: false,
      status: 429,
      error: "Too many requests.",
    });
    expect(
      (
        await requestCode(
          post("/api/certificates/code", { email: EMAIL, botToken: "t" }),
        )
      ).status,
    ).toBe(429);
    expect(mocks.verifyBot).toHaveBeenLastCalledWith(
      expect.anything(),
      "t",
      "certificate_code",
    );
    vi.stubEnv("CANDIDATE_STATUS_SECRET", "");
    expect(
      (
        await requestCode(
          post("/api/certificates/code", { email: EMAIL, botToken: "t" }),
        )
      ).status,
    ).toBe(503);
  });
});

describe("POST /api/certificates/verify and session routes", () => {
  it("counts wrong codes and locks after five attempts", async () => {
    seedRecipient();
    storeCode("123456");
    for (let i = 1; i <= 5; i++) {
      const response = await verifyCode(
        post("/api/certificates/verify", { email: EMAIL, code: "654321" }),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "That code is incorrect or has expired. Request a new one.",
      });
      expect(mocks.store.get(`certificate_codes/${emailHash}`)!.attempts).toBe(
        i,
      );
    }
    const locked = await verifyCode(
      post("/api/certificates/verify", { email: EMAIL, code: "123456" }),
    );
    expect(locked.status).toBe(401);
    expect(locked.headers.get("set-cookie")).toBeNull();
  });
  it("rejects expired and malformed codes", async () => {
    seedRecipient();
    storeCode("123456", { expires_at: Date.now() - 1 });
    expect(
      (
        await verifyCode(
          post("/api/certificates/verify", { email: EMAIL, code: "123456" }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await verifyCode(
          post("/api/certificates/verify", { email: EMAIL, code: "12345" }),
        )
      ).status,
    ).toBe(400);
  });
  it("issues a session for a correct code, consumes it, then serves me and the PNG", async () => {
    seedRecipient();
    storeCode("123456");
    const response = await verifyCode(
      post("/api/certificates/verify", { email: EMAIL, code: "123 456" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.certificate).toEqual({
      name: "Kushal Kumar Putti",
      rank: 7,
      verificationCode: "5JHT-G97D",
      verifyUrl: "https://ascent.amshq.in/v/5JHT-G97D",
      filename: "Ascent-26-Round-1-Certificate-Kushal-Kumar-Putti.png",
      issuedOn: "11 November 2026",
    });
    expect(mocks.store.has(`certificate_codes/${emailHash}`)).toBe(false);
    const cookie = response.cookies.get(CERTIFICATE_COOKIE)!;
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 1800,
    });
    expect(
      (
        await verifyCode(
          post("/api/certificates/verify", { email: EMAIL, code: "123456" }),
        )
      ).status,
    ).toBe(401);

    const session = await me(get("/api/certificates/me", cookie.value));
    expect(session.status).toBe(200);
    expect((await session.json()).certificate).toEqual(body.certificate);
    expect((await me(get("/api/certificates/me"))).status).toBe(401);

    const file = await download(
      get("/api/certificates/download", cookie.value),
    );
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect(file.headers.get("content-disposition")).toBe(
      'attachment; filename="Ascent-26-Round-1-Certificate-Kushal-Kumar-Putti.png"',
    );
    expect(file.headers.get("content-length")).toBe(String(FILE.byteLength));
    expect(file.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await file.arrayBuffer()).equals(FILE)).toBe(true);
    const inline = await download(
      get("/api/certificates/download?disposition=inline", cookie.value),
    );
    expect(inline.headers.get("content-disposition")).toMatch(/^inline; /);
    expect((await download(get("/api/certificates/download"))).status).toBe(
      401,
    );

    mocks.store.set("certificate_file_chunks/ascent-2026-r1-007_1", {
      file_id: "ascent-2026-r1-007",
      index: 1,
      data: Buffer.alloc(FILE.byteLength - 20),
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      (await download(get("/api/certificates/download", cookie.value))).status,
    ).toBe(500);
    error.mockRestore();

    const cleared = await signOut(
      new NextRequest("https://ascent.test/api/certificates/session", {
        method: "DELETE",
        headers: { origin: "https://ascent.test" },
      }),
    );
    expect(cleared.status).toBe(200);
    expect(cleared.cookies.get(CERTIFICATE_COOKIE)).toMatchObject({
      value: "",
      maxAge: 0,
    });
    expect(
      (
        await signOut(
          new NextRequest("https://ascent.test/api/certificates/session", {
            method: "DELETE",
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("limits verification attempts per IP", async () => {
    for (let i = 0; i < 30; i++)
      await verifyCode(
        post("/api/certificates/verify", { email: EMAIL, code: "000000" }),
      );
    expect(
      (
        await verifyCode(
          post("/api/certificates/verify", { email: EMAIL, code: "000000" }),
        )
      ).status,
    ).toBe(429);
  });
});
