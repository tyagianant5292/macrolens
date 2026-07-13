import { auth } from "@/auth";
import { prisma } from "./prisma";

/// What a new account starts with. Just a starting point — the whole thing is editable, so
/// somebody who eats five times a day isn't stuck pretending it's four.
const DEFAULT_MEALS = ["Breakfast", "Lunch", "Snacks", "Dinner"];

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
    include: { goal: true, meals: { orderBy: { order: "asc" } } },
  });
  if (!user) return null; // token outlived the row (deleted account)

  // The revocation check. Sessions are JWTs and can't be deleted server-side, so a token is
  // only good while its stamped version still matches the account's. Changing the password
  // bumps the account's version, and every token minted before that stops working here — which
  // is the only reason "sign out everywhere" can mean anything at all.
  if (session.tokenVersion !== user.tokenVersion) return null;

  // Auth.js's adapter creates the User row and knows nothing about goals or meals, so the
  // first request from a new account has to fill them in.
  if (!user.goal) {
    user.goal = await prisma.goal.create({ data: { userId: user.id } });
  }

  if (user.meals.length === 0) {
    await prisma.mealSlot.createMany({
      data: DEFAULT_MEALS.map((name, order) => ({ userId: user.id, name, order })),
    });
    user.meals = await prisma.mealSlot.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
    });
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
