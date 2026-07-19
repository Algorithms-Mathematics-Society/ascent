import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/session";
import type { Application } from "@/types/registration";

export default async function PathPage() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) {
    redirect("/register");
  }

  const appSnap = await adminDb
    .collection("applications")
    .doc(session.uid)
    .get();
  if (!appSnap.exists) {
    redirect("/register/handle");
  }
  const application = appSnap.data() as Application;
  if (application.state !== "QUALIFICATION_DETERMINED") {
    redirect("/register/profile");
  }

  const isAutoTier = application.college_tier === "AUTO_QUALIFY";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-white">
        You&apos;re registered, {application.handle}.
      </h1>
      {isAutoTier ? (
        <p className="text-ascent-muted">
          Your college is on the auto-qualify list. College email verification
          opens soon. You&apos;ll get an email when it&apos;s ready. Verifying
          skips the qualifier; if you don&apos;t verify in time, you&apos;ll
          compete in the qualifier instead.
        </p>
      ) : (
        <p className="text-ascent-muted">
          You&apos;ll compete in the qualifier round on AMS Access. Scheduling
          opens soon. You&apos;ll get an email when it&apos;s ready.
        </p>
      )}
    </main>
  );
}
