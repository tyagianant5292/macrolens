import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

const goalSchema = z.object({
  kcal: z.number().int().min(500).max(10000),
  protein: z.number().int().min(0).max(500),
  carbs: z.number().int().min(0).max(1000),
  fat: z.number().int().min(0).max(400),
  fiber: z.number().int().min(0).max(200),
});

export async function GET() {
  const { user, res } = await requireUser();
  if (res) return res;
  return Response.json(user.goal);
}

export async function PUT(request: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;

  const parsed = goalSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const goal = await prisma.goal.update({
    where: { userId: user.id },
    data: parsed.data,
  });

  return Response.json(goal);
}
