import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/register/ProfileForm";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/session";

export default async function ProfilePage() {
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
  if (appSnap.data()?.state === "QUALIFICATION_DETERMINED") {
    redirect("/register/path");
  }

  return <ProfileForm />;
}
