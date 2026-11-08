import { NextResponse } from "next/server";
import { requestHasSameOrigin } from "@/lib/adminSecurity";
import { readBoundedJson, RequestBodyTooLarge } from "@/lib/requestBody";
import { normalizeResultUsername } from "@/lib/results";
import { findRoundOneResult } from "@/lib/resultsData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  } });
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return reply({ error: "Request not accepted. Reload this page and try again." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply({ error: "Invalid request." }, 415);
  try {
    const body = await readBoundedJson(request, 1024);
    const username = normalizeResultUsername(body && typeof body === "object" && "username" in body ? body.username : null);
    if (!username) return reply({ error: "Enter your contest username, without spaces." }, 400);
    const result = await findRoundOneResult(username);
    if (!result) return reply({ error: "We couldn’t find that username. Copy the username you used for Round 1 and try again. Your email or Codeforces handle may be different." }, 404);
    return reply(result);
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) return reply({ error: "That request is too large. Enter only your contest username." }, 413);
    if (error instanceof SyntaxError) return reply({ error: "Invalid request." }, 400);
    return reply({ error: "Results are temporarily unavailable. Please try again shortly." }, 503);
  }
}
