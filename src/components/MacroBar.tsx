"use client";

import { round } from "@/lib/nutrition/types";

type Props = {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
};

/// One macro's progress toward its goal. Overshoot is shown by the number turning red
/// rather than the bar overflowing — a bar past 100% tells you nothing about by how much.
export function MacroBar({ label, value, goal, unit, color }: Props) {
  const pct = goal > 0 ? (value / goal) * 100 : 0;
  const over = pct > 100;

  return (
    <div>
      {/* The label and value are always visible next to the bar. That direct labelling is
          what lets the macro palette sit in the CVD floor band — identity never rests on
          colour alone. Don't strip these to make it "cleaner". */}
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={over ? "font-medium text-[var(--over)]" : "text-foreground"}>
          {round(value, 0)}
          <span className="text-muted">
            /{goal}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: over ? "var(--over)" : color,
          }}
        />
      </div>
    </div>
  );
}
