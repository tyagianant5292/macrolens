import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

const createSchema = z.object({ name: z.string().trim().min(1).max(30) });

export async function GET() {
  const { user, res } = await requireUser();
  if (res) return res;
  return Response.json(user.meals);
}

export async function POST(request: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Give the meal a name" }, { status: 400 });
  }
  const { name } = parsed.data;

  if (user.meals.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
    return Response.json({ error: `You already have a "${name}"` }, { status: 409 });
  }

  const meal = await prisma.mealSlot.create({
    data: {
      userId: user.id,
      name,
      // Append. Reordering is a separate, explicit action.
      order: user.meals.length,
    },
  });

  return Response.json(meal, { status: 201 });
}
