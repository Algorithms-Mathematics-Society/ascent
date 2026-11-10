import { NextRequest, NextResponse } from "next/server";
import logger, { genReqId } from "@/lib/logger";
import { buildCertificateSummary, CertificateIntegrityError, getCachedCertificateRecipient, loadCertificateFile } from "@/lib/certificates/data";
import { CERTIFICATE_COOKIE, verifyCertificateSession } from "@/lib/certificates/tokens";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
const EXPIRED = "Your session has expired. Request a new code.";

export async function GET(request: NextRequest) {
  const claims = verifyCertificateSession(request.cookies.get(CERTIFICATE_COOKIE)?.value);
  const inline = request.nextUrl.searchParams.get("disposition") === "inline";
  if (!claims) {
    // A download after the session lapsed must not save an error body as a
    // .png. Browsers send <a download> clicks with Sec-Fetch-Dest "empty", so
    // every non-preview request goes back to the portal instead.
    const response = inline
      ? reply({ error: EXPIRED }, 401)
      : NextResponse.redirect(new URL("/certificate?expired=1", request.url), 303);
    if (request.cookies.has(CERTIFICATE_COOKIE)) response.cookies.set(CERTIFICATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  }
  const reqId = genReqId();
  const actorId = claims.emailHash.slice(0, 16);
  try {
    const recipient = await getCachedCertificateRecipient(claims.emailHash);
    if (!recipient) return reply({ error: EXPIRED }, 401);
    const file = await loadCertificateFile(recipient);
    const { filename } = buildCertificateSummary(recipient);
    const disposition = inline ? "inline" : "attachment";
    // A view over the same memory: no second copy of the file.
    return new NextResponse(new Uint8Array(file.buffer, file.byteOffset, file.byteLength) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Content-Length": String(file.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    if (error instanceof CertificateIntegrityError) {
      logger.error("certificates", "file_integrity_failed", { reqId, actorId, detail: { reason: error.reason }, status: "failed" });
      return reply({ error: "Your certificate could not be prepared. Contact team@amshq.in for help." }, 500);
    }
    logger.error("certificates", "download_failed", { reqId, actorId, status: "failed" }, error);
    return reply({ error: "Could not load your certificate. Please try again." }, 503);
  }
}
