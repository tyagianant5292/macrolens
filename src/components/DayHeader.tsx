"use client";

import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { formatDayLabel, shiftDay, todayYmd } from "@/lib/date";
import type { Goal, Totals } from "@/lib/api-types";
import { round } from "@/lib/nutrition/types";
import { MacroBar } from "./MacroBar";

type Props = {
  day: string;
  totals: Totals;
  goal: Goal | null;
  onDayChange: (day: string) => void;
  onEditGoals: () => void;
  /// Slot for the sign-out button. Passed in rather than imported, because that button is a
  /// server component (its action must invalidate the Session row) and this is a client one.
  accessory?: React.ReactNode;
};

export function DayHeader({ day, totals, goal, onDayChange, onEditGoals, accessory }: Props) {
  const kcalGoal = goal?.kcal ?? 0;
  const left = kcalGoal - totals.kcal;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto max-w-lg px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onDayChange(shiftDay(day, -1))}
            aria-label="Previous day"
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>

          <div className="text-center">
            <div className="font-semibold">{formatDayLabel(day)}</div>
            {formatDayLabel(day) !== day && (
              <div className="text-[11px] text-muted">{day}</div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onDayChange(shiftDay(day, 1))}
              // No logging into the future — it's always a mis-tap, never intentional.
              disabled={day >= todayYmd()}
              aria-label="Next day"
              className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
            >
              <ChevronRight className="size-5" />
            </button>
            <button
              onClick={onEditGoals}
              aria-label="Edit goals"
              className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
            >
              <Settings2 className="size-[18px]" />
            </button>
            {accessory}
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="font-mono text-3xl font-semibold tabular-nums">
              {round(totals.kcal, 0)}
              <span className="ml-1 text-base font-normal text-muted">kcal</span>
            </div>
          </div>
          {goal && (
            <div className="text-right text-xs">
              <div className="text-muted">{left >= 0 ? "left" : "over"}</div>
              <div
                className={`font-mono text-lg tabular-nums ${
                  left >= 0 ? "text-foreground" : "text-red-400"
                }`}
              >
                {round(Math.abs(left), 0)}
              </div>
            </div>
          )}
        </div>

        {goal && (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <MacroBar
              label="Protein"
              value={totals.protein}
              goal={goal.protein}
              unit="g"
              color="var(--protein)"
            />
            <MacroBar
              label="Carbs"
              value={totals.carbs}
              goal={goal.carbs}
              unit="g"
              color="var(--carbs)"
            />
            <MacroBar label="Fat" value={totals.fat} goal={goal.fat} unit="g" color="var(--fat)" />
            <MacroBar
              label="Fiber"
              value={totals.fiber}
              goal={goal.fiber}
              unit="g"
              color="var(--fiber)"
            />
          </div>
        )}
      </div>
    </header>
  );
}
