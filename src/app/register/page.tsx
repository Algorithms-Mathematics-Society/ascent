import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SignInForm from "@/components/register/SignInForm";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/session";

export default async function RegisterPage() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;

  if (session) {
    const appSnap = await adminDb
      .collection("applications")
      .doc(session.uid)
      .get();
    if (!appSnap.exists) {
      redirect("/register/handle");
    }
    const state = appSnap.data()?.state;
    redirect(
      state === "QUALIFICATION_DETERMINED"
        ? "/register/path"
        : "/register/profile",
    );
  }

  return <SignInForm />;
}
