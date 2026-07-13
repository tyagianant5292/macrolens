import type { NextRequest } from "next/server";
import { z } from "zod";
import { round, type MicroKey, type Micros } from "@/lib/nutrition/types";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

const patchSchema = z.object({ grams: z.number().positive().max(5000) });

/// Change a portion. Rather than re-resolving the food, we rescale the numbers already on
/// the row — nutrition is linear in grams, so the ratio is all we need and it costs no
/// USDA or model call. It also means a hand-corrected entry stays hand-corrected.
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, res } = await requireUser();
  if (res) return res;

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const { grams } = parsed.data;

  const entry = await prisma.foodEntry.findFirst({ where: { id, userId: user.id } });
  if (!entry) return Response.json({ error: "not found" }, { status: 404 });

  const f = grams / entry.grams;
  const micros: Micros = {};
  const existing = entry.micros as Record<string, unknown> | null;
  for (const [k, v] of Object.entries(existing ?? {})) {
    if (typeof v === "number") micros[k as MicroKey] = round(v * f, 2);
  }

  const updated = await prisma.foodEntry.update({
    where: { id },
    data: {
      grams,
      // Keep quantity in step so the label still reads sensibly ("2 roti" → "3 roti").
      quantity: round(entry.quantity * f, 2),
      kcal: round(entry.kcal * f),
      protein: round(entry.protein * f),
      carbs: round(entry.carbs * f),
      fat: round(entry.fat * f),
      fiber: round(entry.fiber * f),
      sugar: round(entry.sugar * f),
      micros,
    },
  });

  return Response.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { user, res } = await requireUser();
  if (res) return res;

  // deleteMany, not delete: scoping by userId means another user's id 404s instead of deleting.
  const { count } = await prisma.foodEntry.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ ok: true });
}
