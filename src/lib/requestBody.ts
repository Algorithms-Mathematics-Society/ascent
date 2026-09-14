export class RequestBodyTooLarge extends Error {
  constructor() { super("Request body is too large."); }
}

/** Bound actual streamed bytes, including requests without Content-Length. */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<ArrayBuffer> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new RequestBodyTooLarge();
  }
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await readBoundedBody(request, maxBytes)));
}
