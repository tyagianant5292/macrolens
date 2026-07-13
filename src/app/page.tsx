import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DayView } from "@/components/DayView";

/// The auth gate for the app itself, enforced on the server before a byte of the log is sent.
///
/// This is deliberately here rather than in `proxy.ts`: Clerk deprecated middleware-based
/// protection because path matching can diverge from real routing. Checking at the resource
/// can't diverge — if this component renders, the user is signed in.
export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <DayView />;
}
