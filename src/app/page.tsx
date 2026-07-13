import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DayView } from "@/components/DayView";
import { SignOutButton } from "@/components/SignOutButton";

/// The auth gate for the app itself, enforced on the server before a byte of the log is sent.
/// If this component renders, the user is signed in — there is no client-side check to defeat.
export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  // DayView is a client component, so the (server-action-backed) sign-out button has to be
  // handed in as a prop rather than imported inside it.
  return <DayView accessory={<SignOutButton />} />;
}
