"use client";

import { useState } from "react";
import type { Goal } from "@/lib/api-types";

export type WeekDay = {
  date: string;
  logged: boolean;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Props = {
  days: WeekDay[];
  goal: Goal;
  averages: { loggedDays: number; kcal: number; protein: number; carbs: number; fat: number };
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const dayLetter = (ymd: string) => DOW[new Date(`${ymd}T00:00:00Z`).getUTCDay()];

/// One bar per day against a goal line. Single series, so no legend — the heading names it.
/// Days with nothing logged are drawn as a hollow stub rather than a zero-height bar, because
/// a flat bar at zero reads as "ate nothing" when it means "didn't log".
function BarChart({
  days,
  goal,
  metric,
  unit,
  color,
  label,
}: {
  days: WeekDay[];
  goal: number;
  metric: "kcal" | "protein" | "carbs" | "fat";
  unit: string;
  color: string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  // Scale headroom to whichever is taller — the goal line or the biggest day — so the goal
  // line is always on-canvas even on a day you doubled it.
  const peak = Math.max(goal, ...days.map((d) => d[metric]), 1);
  const top = peak * 1.15;
  const H = 64;
  const y = (v: number) => H - (v / top) * H;

  const shown = hover !== null ? days[hover] : null;

  return (
    <figure className="rounded-xl border border-border bg-surface p-4">
      <figcaption className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="font-mono text-xs tabular-nums text-muted">
          {shown ? (
            <>
              <span className="text-foreground">{Math.round(shown[metric])}</span>
              {unit} · {shown.date.slice(5)}
            </>
          ) : (
            <>
              goal {goal}
              {unit}
            </>
          )}
        </span>
      </figcaption>

      <div className="flex items-end gap-1.5" style={{ height: H }}>
        {days.map((d, i) => {
          const v = d[metric];
          const over = v > goal;
          const h = d.logged ? Math.max(H - y(v), 3) : 3;

          return (
            <button
              key={d.date}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              // The hit target is the full column height, not the bar — on a phone a 6px
              // bar is untappable.
              className="group relative flex h-full flex-1 cursor-default items-end"
              aria-label={`${d.date}: ${d.logged ? `${Math.round(v)}${unit}` : "not logged"}`}
            >
              {/* goal line, drawn per-column so it sits behind the bars */}
              <span
                aria-hidden
                className="absolute inset-x-0 border-t border-dashed border-muted/45"
                style={{ bottom: `${(goal / top) * 100}%` }}
              />
              <span
                className="relative w-full rounded-t transition-[height,opacity]"
                style={{
                  height: h,
                  backgroundColor: d.logged ? (over ? "var(--over)" : color) : "transparent",
                  border: d.logged ? undefined : "1px dashed var(--border)",
                  opacity: hover === null || hover === i ? 1 : 0.4,
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {days.map((d, i) => (
          <span
            key={d.date}
            className={`flex-1 text-center text-[10px] ${
              hover === i ? "text-foreground" : "text-muted"
            }`}
          >
            {dayLetter(d.date)}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function WeekChart({ days, goal, averages }: Props) {
  const noData = averages.loggedDays === 0;

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-xs uppercase tracking-wide text-muted">
          Daily average
          <span className="ml-1.5 normal-case tracking-normal">
            ({averages.loggedDays} {averages.loggedDays === 1 ? "day" : "days"} logged)
          </span>
        </h2>

        {noData ? (
          <p className="mt-2 text-sm text-muted">Nothing logged this week yet.</p>
        ) : (
          <>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">
              {averages.kcal}
              <span className="ml-1 text-base font-normal text-muted">kcal</span>
              <span
                className={`ml-2 text-sm ${
                  averages.kcal > goal.kcal ? "text-[var(--over)]" : "text-muted"
                }`}
              >
                {averages.kcal > goal.kcal ? "+" : ""}
                {averages.kcal - goal.kcal}
              </span>
            </div>
            {/* Averaged over logged days only — see /api/week. */}
            <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
              {(["protein", "carbs", "fat"] as const).map((k) => (
                <div key={k} className="rounded-lg bg-surface-2 px-2 py-1.5">
                  <dt className="font-sans text-[10px] capitalize text-muted">{k}</dt>
                  <dd>
                    {averages[k]}
                    <span className="text-muted">/{goal[k]}g</span>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      {/* Small multiples: identity comes from each chart's own heading, so colour never has
          to carry it. That's what makes the palette's CVD floor-band pair safe here. */}
      <BarChart days={days} goal={goal.kcal} metric="kcal" unit=" kcal" color="var(--kcal)" label="Calories" />
      <BarChart days={days} goal={goal.protein} metric="protein" unit="g" color="var(--protein)" label="Protein" />
      <BarChart days={days} goal={goal.carbs} metric="carbs" unit="g" color="var(--carbs)" label="Carbs" />
      <BarChart days={days} goal={goal.fat} metric="fat" unit="g" color="var(--fat)" label="Fat" />
    </div>
  );
}
