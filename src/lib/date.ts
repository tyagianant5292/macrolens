/// Days are handled as "YYYY-MM-DD" strings everywhere except the Prisma boundary.
/// The one rule: never build a day from `new Date().toISOString()` — that's the UTC day,
/// and for anyone east of Greenwich it flips over while they're still eating dinner.

export type Ymd = string;

/// Today in the *browser's* timezone.
export function todayYmd(): Ymd {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isYmd(s: string): s is Ymd {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/// Ymd → the value Prisma writes to a `@db.Date` column. Postgres DATE has no timezone,
/// and Prisma reads/writes it at UTC midnight, so we must pin to UTC midnight here too.
export function toDbDate(day: Ymd): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function fromDbDate(d: Date): Ymd {
  return d.toISOString().slice(0, 10);
}

export function shiftDay(day: Ymd, days: number): Ymd {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDayLabel(day: Ymd): string {
  if (day === todayYmd()) return "Today";
  if (day === shiftDay(todayYmd(), -1)) return "Yesterday";
  if (day === shiftDay(todayYmd(), 1)) return "Tomorrow";
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
