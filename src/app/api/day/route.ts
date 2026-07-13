import type { NextRequest } from "next/server";
import { fromDbDate, isYmd, toDbDate, todayYmd } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { sumEntries } from "@/lib/totals";
import { requireUser } from "@/lib/user";

/// Everything the day view needs in one round-trip: entries grouped by meal, per-meal
/// totals, the day total, and the user's goals.
export async function GET(request: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;

  const param = request.nextUrl.searchParams.get("date");
  const day = param && isYmd(param) ? param : todayYmd();

  const rows = await prisma.foodEntry.findMany({
    where: { userId: user.id, date: toDbDate(day) },
    orderBy: { createdAt: "asc" },
  });

  const entries = rows.map((r) => ({ ...r, date: fromDbDate(r.date) }));

  return Response.json({
    date: day,
    entries,
    totals: sumEntries(entries),
    goal: user.goal,
  });
}
