"use client";

import { round, TRACKED_MICROS, type MicroKey, type Micros } from "@/lib/nutrition/types";

const MACROS = [
  { key: "protein", label: "Protein", color: "var(--protein)" },
  { key: "carbs", label: "Carbs", color: "var(--carbs)" },
  { key: "fat", label: "Fat", color: "var(--fat)" },
  { key: "fiber", label: "Fiber", color: "var(--fiber)" },
] as const;

export const MICRO_LABELS: Record<MicroKey, string> = {
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

type Nutrition = {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  micros?: Micros | null;
};

/// The macro line under a food's name. Always visible — a dot of colour beside each number so
/// it ties back to the goal bars up top, but the letter is what actually names it.
export function MacroLine({ n }: { n: Nutrition }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] tabular-nums text-muted">
      {MACROS.map((m) => (
        <span key={m.key} className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ backgroundColor: m.color }}
          />
          {round(n[m.key], 0)}
          <span className="text-[9px] uppercase">{m.label.slice(0, 1)}</span>
        </span>
      ))}
    </span>
  );
}

/// The full breakdown, shown when a food is tapped open. Macros with their real names, then
/// every micronutrient the data source actually reported — nothing is invented to fill gaps,
/// so a food with no vitamin data simply shows fewer rows.
export function NutritionDetail({ n }: { n: Nutrition }) {
  const micros = n.micros ?? {};
  const present = (Object.keys(MICRO_LABELS) as MicroKey[]).filter(
    (k) => (micros[k] ?? 0) > 0,
  );

  return (
    <div className="space-y-3 border-t border-border bg-surface-2/50 px-4 py-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {MACROS.map((m) => (
          <div key={m.key} className="flex items-baseline justify-between text-xs">
            <dt className="flex items-center gap-1.5 text-muted">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              {m.label}
            </dt>
            <dd className="font-mono tabular-nums">
              {round(n[m.key], 1)}
              <span className="text-muted">g</span>
            </dd>
          </div>
        ))}
        {n.sugar !== undefined && (
          <div className="flex items-baseline justify-between text-xs">
            <dt className="pl-3.5 text-muted">Sugar</dt>
            <dd className="font-mono tabular-nums">
              {round(n.sugar, 1)}
              <span className="text-muted">g</span>
            </dd>
          </div>
        )}
      </dl>

      {present.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">
            Vitamins &amp; minerals
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {present.map((k) => (
              <div key={k} className="flex items-baseline justify-between text-xs">
                <dt className="text-muted">{MICRO_LABELS[k]}</dt>
                <dd className="font-mono tabular-nums">
                  {round(micros[k]!, 1)}
                  <span className="ml-0.5 text-muted">{TRACKED_MICROS[k]}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="text-[11px] text-muted">
          No vitamin or mineral data for this food.
        </p>
      )}
    </div>
  );
}
