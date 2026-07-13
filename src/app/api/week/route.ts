import type { NextRequest } from "next/server";
import { fromDbDate, isYmd, shiftDay, toDbDate, todayYmd } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { sumEntries } from "@/lib/totals";
import { requireUser } from "@/lib/user";

const DAYS = 7;

/// Daily totals for the week ending on `end` (inclusive), oldest first.
///
/// Days with nothing logged are returned as zeros rather than omitted — a gap in the array
/// would silently become a straight line between the days either side of it, which reads as
/// "you ate consistently" when it means "you didn't log".
export async function GET(request: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;

  const param = request.nextUrl.searchParams.get("end");
  const end = param && isYmd(param) ? param : todayYmd();
  const start = shiftDay(end, -(DAYS - 1));

  const rows = await prisma.foodEntry.findMany({
    where: {
      userId: user.id,
      date: { gte: toDbDate(start), lte: toDbDate(end) },
    },
  });

  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const day = fromDbDate(r.date);
    const list = byDay.get(day);
    if (list) list.push(r);
    else byDay.set(day, [r]);
  }

  const days = Array.from({ length: DAYS }, (_, i) => {
    const day = shiftDay(start, i);
    const entries = byDay.get(day) ?? [];
    return { date: day, logged: entries.length > 0, ...sumEntries(entries) };
  });

  const loggedDays = days.filter((d) => d.logged);
  const mean = (pick: (d: (typeof days)[number]) => number) =>
    loggedDays.length === 0
      ? 0
      : Math.round(loggedDays.reduce((s, d) => s + pick(d), 0) / loggedDays.length);

  return Response.json({
    days,
    goal: user.goal,
    // Averaged over days you actually logged. Including untracked zeros would flatter every
    // cut and sabotage every bulk.
    averages: {
      loggedDays: loggedDays.length,
      kcal: mean((d) => d.kcal),
      protein: mean((d) => d.protein),
      carbs: mean((d) => d.carbs),
      fat: mean((d) => d.fat),
    },
  });
}
