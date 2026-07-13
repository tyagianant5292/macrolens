import type { NextRequest } from "next/server";
import { z } from "zod";
import { isYmd, toDbDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

const bodySchema = z.object({
  date: z.string().refine(isYmd, "expected YYYY-MM-DD"),
  /// Verified below to be one of this user's own slots — otherwise you could file food into
  /// somebody else's meal by guessing an id.
  mealId: z.string().min(1),
  /// From /api/analyze. Also verified to belong to this user — otherwise anyone could attach
  /// (and then read back) someone else's photo by guessing an id.
  photoId: z.string().optional(),
  barcode: z.string().optional(),
  /// Already resolved by /api/parse or /api/analyze and possibly edited by the user in the
  /// review sheet, so we trust the numbers on the way in rather than re-resolving them.
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().positive(),
        unit: z.string().min(1),
        grams: z.number().positive(),
        kcal: z.number().nonnegative(),
        protein: z.number().nonnegative(),
        carbs: z.number().nonnegative(),
        fat: z.number().nonnegative(),
        fiber: z.number().nonnegative().default(0),
        sugar: z.number().nonnegative().default(0),
        micros: z.record(z.string(), z.number()).default({}),
        source: z.enum(["USDA", "OFF", "AI", "MANUAL"]),
        confidence: z.enum(["high", "medium", "low"]).nullish(),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  // Authenticate before validating. The other way round, an anonymous caller gets back a
  // zod error tree and can map the whole schema without ever signing in.
  const { user, res } = await requireUser();
  if (res) return res;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const { date, mealId, items, photoId, barcode } = parsed.data;

  // The meal must be one of this user's own slots. Unlike the photo below, a bad mealId is
  // fatal — there's nowhere to put the food.
  if (!user.meals.some((m) => m.id === mealId)) {
    return Response.json({ error: "No such meal" }, { status: 400 });
  }

  // Never take a client-supplied id on trust. If the photo isn't this user's, drop the link
  // rather than reject the meal — the food is still worth logging.
  const ownsPhoto =
    photoId != null &&
    (await prisma.photo.count({ where: { id: photoId, userId: user.id } })) > 0;

  await prisma.foodEntry.createMany({
    data: items.map((item) => ({
      userId: user.id,
      date: toDbDate(date),
      mealId,
      photoId: ownsPhoto ? photoId : null,
      barcode,
      ...item,
      confidence: item.confidence ?? null,
    })),
  });

  return Response.json({ ok: true, added: items.length }, { status: 201 });
}
