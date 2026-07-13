import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  /// Move this slot to a new position; everything between shifts to make room.
  order: z.number().int().min(0).max(50).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (res) return res;

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  const meal = user.meals.find((m) => m.id === id);
  if (!meal) return Response.json({ error: "not found" }, { status: 404 });

  const { name, order } = parsed.data;

  if (name && user.meals.some((m) => m.id !== id && m.name.toLowerCase() === name.toLowerCase())) {
    return Response.json({ error: `You already have a "${name}"` }, { status: 409 });
  }

  if (order === undefined) {
    const updated = await prisma.mealSlot.update({ where: { id }, data: { name } });
    return Response.json(updated);
  }

  // Reordering: pull the slot out, drop it back in at the target index, then renumber the
  // whole list. Renumbering everything is O(n) on a list of ~6 — far simpler than trying to
  // patch individual orders, and it can't leave gaps or ties behind.
  const rest = user.meals.filter((m) => m.id !== id);
  const target = Math.min(order, rest.length);
  rest.splice(target, 0, { ...meal, name: name ?? meal.name });

  await prisma.$transaction(
    rest.map((m, i) =>
      prisma.mealSlot.update({
        where: { id: m.id },
        data: { order: i, ...(m.id === id && name ? { name } : {}) },
      }),
    ),
  );

  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (res) return res;

  const { id } = await ctx.params;
  if (!user.meals.some((m) => m.id === id)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  // Refuse rather than cascade. Deleting "Snacks" must not silently take three months of
  // logged snacks with it — the schema enforces this too (onDelete: Restrict), but a clear
  // message beats a foreign-key error.
  const entries = await prisma.foodEntry.count({ where: { mealId: id, userId: user.id } });
  if (entries > 0) {
    return Response.json(
      {
        error: `That meal still has ${entries} logged item${entries === 1 ? "" : "s"}. Delete them first.`,
      },
      { status: 409 },
    );
  }

  if (user.meals.length === 1) {
    return Response.json({ error: "You need at least one meal" }, { status: 409 });
  }

  await prisma.mealSlot.delete({ where: { id } });

  // Close the gap the deletion left, so orders stay 0..n-1.
  const rest = user.meals.filter((m) => m.id !== id);
  await prisma.$transaction(
    rest.map((m, i) => prisma.mealSlot.update({ where: { id: m.id }, data: { order: i } })),
  );

  return Response.json({ ok: true });
}
