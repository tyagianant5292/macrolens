import { redirect } from "next/navigation";
import { DayView } from "@/components/DayView";
import { SignOutButton } from "@/components/SignOutButton";
import { getCurrentUser } from "@/lib/user";

/// The auth gate for the app, enforced on the server before a byte of the log is sent.
///
/// getCurrentUser(), NOT auth(). `auth()` only checks that the JWT's signature is valid — it
/// knows nothing about tokenVersion, so a token revoked by a password change still passes it.
/// That gap rendered the app shell to a revoked session, whose API calls then all 401'd.
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // DayView is a client component, so the (server-action-backed) sign-out button has to be
  // handed in as a prop rather than imported inside it.
  return <DayView accessory={<SignOutButton />} />;
}
