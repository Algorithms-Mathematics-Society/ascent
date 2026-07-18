import { describe, it, expect } from "vitest";
import {
  validateHandle,
  normalizeIndianPhone,
  validateResumeBuffer,
} from "../src/lib/validators";

describe("validateHandle", () => {
  it("accepts a well-formed handle", () => {
    expect(validateHandle("tilak_j").valid).toBe(true);
  });

  it("rejects handles under 3 characters", () => {
    const result = validateHandle("ab");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/3-24 characters/);
  });

  it("rejects handles over 24 characters", () => {
    const result = validateHandle("a".repeat(25));
    expect(result.valid).toBe(false);
  });

  it("rejects a handle starting with a digit", () => {
    const result = validateHandle("1tilak");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/start with a letter/);
  });

  it("rejects handles with spaces or symbols", () => {
    expect(validateHandle("til ak").valid).toBe(false);
    expect(validateHandle("til@ak").valid).toBe(false);
  });
});

describe("normalizeIndianPhone", () => {
  it("normalizes a bare 10-digit number to E.164", () => {
    expect(normalizeIndianPhone("9876543210")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
  });

  it("strips a leading 0", () => {
    expect(normalizeIndianPhone("09876543210")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
  });

  it("strips a leading country code", () => {
    expect(normalizeIndianPhone("919876543210")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
  });

  it("rejects a number not starting with 6-9", () => {
    const result = normalizeIndianPhone("5876543210");
    expect(result.valid).toBe(false);
  });

  it("rejects a too-short number", () => {
    const result = normalizeIndianPhone("98765");
    expect(result.valid).toBe(false);
  });
});

describe("validateResumeBuffer", () => {
  const pdfBuffer = Buffer.concat([
    Buffer.from("%PDF-1.4\n"),
    Buffer.alloc(100),
  ]);

  it("accepts a small valid PDF", () => {
    expect(validateResumeBuffer(pdfBuffer, 500 * 1024)).toEqual({
      valid: true,
    });
  });

  it("rejects an empty buffer", () => {
    const result = validateResumeBuffer(Buffer.alloc(0), 500 * 1024);
    expect(result.valid).toBe(false);
  });

  it("rejects a buffer over the size cap", () => {
    const result = validateResumeBuffer(pdfBuffer, 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/under/);
  });

  it("rejects a buffer without the PDF magic bytes", () => {
    const result = validateResumeBuffer(Buffer.from("not a pdf"), 500 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/valid PDF/);
  });
});
