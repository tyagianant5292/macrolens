import { auth } from "@/auth";
import { prisma } from "./prisma";

/// The signed-in user's row, or null.
///
/// Auth.js already created the User row (the Prisma adapter does it the first time a magic
/// link is used), so this only has to load it — and make sure it has a Goal, since the adapter
/// knows nothing about ours.
///
/// Returns null when nobody is signed in. Callers MUST handle that: this function is the only
/// thing standing between one person's food log and everyone else's.
export async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { goal: true },
  });
  if (!user) return null; // session outlived the row (deleted account)

  if (!user.goal) {
    const goal = await prisma.goal.create({ data: { userId: user.id } });
    return { ...user, goal };
  }

  return user;
}

export type Authed = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/// The shape every authenticated route wants: a user, or a 401 to return.
export async function requireUser(): Promise<
  { user: Authed; res?: never } | { user?: never; res: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { res: Response.json({ error: "Not signed in" }, { status: 401 }) };
  }
  return { user };
}
