import { type NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const snap = await adminDb
    .collection("colleges")
    .where("active", "==", true)
    .where("search_terms", "array-contains", q)
    .limit(10)
    .get();

  const results = snap.docs.map((docSnap) => ({
    college_id: docSnap.id,
    canonical_name: docSnap.data().canonical_name as string,
    campus: (docSnap.data().campus as string | null) ?? null,
    tier: docSnap.data().tier as "AUTO_QUALIFY" | "STANDARD",
  }));

  return NextResponse.json({ results });
}
