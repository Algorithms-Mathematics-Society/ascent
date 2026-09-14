import { describe, expect, it } from "vitest";
import { readBoundedBody, readBoundedJson, RequestBodyTooLarge } from "../src/lib/requestBody";

function chunked(chunks: string[], onCancel = () => {}) {
  return new Request("https://ascent.test/api/reminders", {
    method: "POST",
    body: new ReadableStream({
      start(controller) { chunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk))); },
      cancel: onCancel,
    }),
    duplex: "half",
  } as RequestInit);
}

describe("bounded request parsing", () => {
  it("rejects chunked oversized requests and cancels the stream", async () => {
    let cancelled = false;
    await expect(readBoundedBody(chunked(["1234", "5678"], () => { cancelled = true; }), 6)).rejects.toBeInstanceOf(RequestBodyTooLarge);
    expect(cancelled).toBe(true);
  });
  it("counts UTF-8 bytes rather than characters", async () => {
    await expect(readBoundedBody(chunked(["ééé"]), 5)).rejects.toBeInstanceOf(RequestBodyTooLarge);
  });
  it("rejects oversized declared lengths before consuming the body", async () => {
    const request = new Request("https://ascent.test/", { method: "POST", headers: { "content-length": "9999" }, body: "{}" });
    await expect(readBoundedBody(request, 100)).rejects.toBeInstanceOf(RequestBodyTooLarge);
    expect(request.bodyUsed).toBe(false);
  });
  it("parses a valid JSON body at the limit", async () => {
    expect(await readBoundedJson(new Request("https://ascent.test/", { method: "POST", body: '{"a":1}' }), 7)).toEqual({ a: 1 });
  });
});
