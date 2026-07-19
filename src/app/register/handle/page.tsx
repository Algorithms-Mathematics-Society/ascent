import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HandleForm from "@/components/register/HandleForm";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/session";

export default async function HandlePage() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) {
    redirect("/register");
  }

  const appSnap = await adminDb
    .collection("applications")
    .doc(session.uid)
    .get();
  if (appSnap.exists) {
    const state = appSnap.data()?.state;
    redirect(
      state === "QUALIFICATION_DETERMINED"
        ? "/register/path"
        : "/register/profile",
    );
  }

  return <HandleForm />;
}
