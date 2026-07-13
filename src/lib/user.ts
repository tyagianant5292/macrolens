import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";

/// Resolve the signed-in Clerk user to our local row, creating it on first sight.
///
/// Clerk owns identity; we own the diet log. The join is `User.clerkId` — never email, which
/// is display data the user can change out from under us.
///
/// Returns null when nobody is signed in. Callers MUST handle that: this function is the only
/// thing standing between one person's food log and everyone else's.
export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await prisma.user.findUnique({
    where: { clerkId },
    include: { goal: true },
  });
  if (existing?.goal) return existing;

  // First request from this Clerk account (or a user whose Goal row is somehow missing).
  const clerkUser = await currentUser();

  return prisma.user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      email: clerkUser?.primaryEmailAddress?.emailAddress ?? null,
      name: clerkUser?.firstName ?? null,
      goal: { create: {} },
    },
    update: { goal: { create: {} } },
    include: { goal: true },
  });
}

/// The shape every authenticated route wants: a user, or a 401 to return.
export type Authed = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<
  { user: Authed; res?: never } | { user?: never; res: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { res: Response.json({ error: "Not signed in" }, { status: 401 }) };
  }
  return { user };
}
