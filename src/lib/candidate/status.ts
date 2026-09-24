import "server-only";
import { adminDb } from "../firebaseAdmin";
import { sha256 } from "../rateLimit";
import { verifyStatusToken } from "./tokens";
import { normalizeEmail } from "../validators";
import { TIMELINE } from "@/content/sections";

export type CandidateStatus = {
  reference: string; state: "RECEIVED" | "UNDER_REVIEW" | "APPROVED" | "WAITLISTED" | "REJECTED" | "WITHDRAWN";
  qualificationPath: "AUTO" | "QUALIFIER"; roundOneDate: string;
};
export async function getCandidateStatus(session: string | undefined): Promise<CandidateStatus | null> {
  const claims = verifyStatusToken(session, "session");
  if (!claims) return null;
  const [application, pii, operations] = await adminDb.getAll(
    adminDb.collection("applications").doc(claims.subject), adminDb.collection("pii").doc(claims.subject),
    adminDb.collection("admin_registration_operations").doc(claims.subject),
  );
  const app = application.data();
  const address = pii.data()?.email;
  const email = normalizeEmail(typeof address === "string" ? address : "");
  if (!app || app.state === "DELETED" || !email.normalized || sha256(email.normalized) !== claims.emailHash) return null;
  const decision = app.admin_decision;
  const state = app.state === "WITHDRAWN" ? "WITHDRAWN" : ["APPROVED", "WAITLISTED", "REJECTED"].includes(decision) ? decision :
    app.review_started_at || (operations.data()?.revision || 0) > 0 ? "UNDER_REVIEW" : "RECEIVED";
  // Explicit allowlist: no names, contact details, documents or internal notes.
  return { reference: typeof app.reference === "string" ? app.reference : "Not recorded", state,
    qualificationPath: app.qualification_path === "AUTO" ? "AUTO" : "QUALIFIER",
    roundOneDate: TIMELINE[1].timing };
}
