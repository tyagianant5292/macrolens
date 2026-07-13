"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Totals } from "@/lib/api-types";
import { TRACKED_MICROS, type MicroKey } from "@/lib/nutrition/types";

const LABELS: Record<MicroKey, string> = {
  iron: "Iron",
  calcium: "Calcium",
  magnesium: "Magnesium",
  potassium: "Potassium",
  sodium: "Sodium",
  zinc: "Zinc",
  vitaminA: "Vitamin A",
  vitaminC: "Vitamin C",
  vitaminD: "Vitamin D",
  vitaminB12: "Vitamin B12",
  folate: "Folate",
  cholesterol: "Cholesterol",
};

/// Collapsed by default. Micros are a "check once a week" number, not something you want
/// between you and today's protein total.
export function MicrosPanel({ totals }: { totals: Totals }) {
  const [open, setOpen] = useState(false);

  const present = (Object.keys(LABELS) as MicroKey[]).filter((k) => (totals.micros[k] ?? 0) > 0);
  if (present.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <h2 className="text-sm font-semibold">Micronutrients</h2>
        <ChevronDown
          className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border px-4 py-3">
          {present.map((k) => (
            <div key={k} className="flex items-baseline justify-between text-xs">
              <dt className="text-muted">{LABELS[k]}</dt>
              <dd className="font-mono tabular-nums">
                {totals.micros[k]}
                <span className="ml-0.5 text-muted">{TRACKED_MICROS[k]}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
