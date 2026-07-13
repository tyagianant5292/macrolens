"use client";

import { Barcode, Plus, Sparkles, Trash2 } from "lucide-react";
import { MEAL_LABELS, type Entry, type Meal } from "@/lib/api-types";
import { round } from "@/lib/nutrition/types";
import { sumEntries } from "@/lib/totals";

type Props = {
  meal: Meal;
  entries: Entry[];
  onAdd: (meal: Meal) => void;
  onDelete: (id: string) => void;
  onGramsChange: (id: string, grams: number) => void;
};

export function MealCard({ meal, entries, onAdd, onDelete, onGramsChange }: Props) {
  const totals = sumEntries(entries);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">{MEAL_LABELS[meal]}</h2>
          {entries.length > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted">
              {round(totals.kcal, 0)} kcal · {round(totals.protein, 0)}g P
            </span>
          )}
        </div>
        <button
          onClick={() => onAdd(meal)}
          aria-label={`Add food to ${MEAL_LABELS[meal]}`}
          className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {entries.length === 0 ? (
        <button
          onClick={() => onAdd(meal)}
          className="w-full border-t border-border px-4 py-4 text-left text-xs text-muted hover:bg-surface-2"
        >
          Nothing logged yet — tap to add
        </button>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {entries.map((e) => (
            <li key={e.id} className="group flex items-center gap-3 px-4 py-2.5">
              {e.photoId && (
                // next/image can't optimise an authenticated API route, and the client
                // already downscaled these to ~80KB — there's nothing left to optimise.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/photos/${e.photoId}`}
                  alt=""
                  loading="lazy"
                  className="size-9 shrink-0 rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm capitalize">{e.name}</span>
                  {e.source === "AI" && (
                    // The user needs to know which numbers are a model's guess vs. lab data.
                    <span
                      title="Estimated by AI — not from a nutrition database"
                      className="flex shrink-0 items-center gap-0.5 rounded bg-surface-2 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted"
                    >
                      <Sparkles className="size-2.5" />
                      est
                    </span>
                  )}
                  {e.source === "OFF" && (
                    <span
                      title="From the manufacturer's label, via barcode"
                      className="grid size-3.5 shrink-0 place-items-center text-muted"
                    >
                      <Barcode className="size-3" />
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                  <input
                    type="number"
                    inputMode="numeric"
                    defaultValue={round(e.grams, 0)}
                    min={1}
                    max={5000}
                    onBlur={(ev) => {
                      const g = Number(ev.target.value);
                      if (g > 0 && g !== round(e.grams, 0)) onGramsChange(e.id, g);
                      else ev.target.value = String(round(e.grams, 0));
                    }}
                    className="w-11 rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono tabular-nums hover:border-border focus:border-border focus:outline-none"
                  />
                  <span>g</span>
                  <span className="mx-0.5 text-border">·</span>
                  <span className="font-mono tabular-nums">
                    {round(e.protein, 0)}P {round(e.carbs, 0)}C {round(e.fat, 0)}F
                  </span>
                </div>
              </div>

              <span className="shrink-0 font-mono text-sm tabular-nums">
                {round(e.kcal, 0)}
              </span>

              <button
                onClick={() => onDelete(e.id)}
                aria-label={`Remove ${e.name}`}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-muted opacity-0 transition hover:text-red-400 focus:opacity-100 group-hover:opacity-100 max-md:opacity-60"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
