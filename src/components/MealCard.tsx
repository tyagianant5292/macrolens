"use client";

import { Barcode, ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Entry, MealSlot } from "@/lib/api-types";
import { round } from "@/lib/nutrition/types";
import { sumEntries } from "@/lib/totals";
import { MacroLine, NutritionDetail } from "./NutritionRow";

type Props = {
  meal: MealSlot;
  entries: Entry[];
  onAdd: (meal: MealSlot) => void;
  onDelete: (id: string) => void;
  onGramsChange: (id: string, grams: number) => void;
};

export function MealCard({ meal, entries, onAdd, onDelete, onGramsChange }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const totals = sumEntries(entries);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">{meal.name}</h2>
          {entries.length > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted">
              {round(totals.kcal, 0)} kcal · {round(totals.protein, 0)}g P
            </span>
          )}
        </div>
        <button
          onClick={() => onAdd(meal)}
          aria-label={`Add food to ${meal.name}`}
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
          {entries.map((e) => {
            const isOpen = open === e.id;

            return (
              <li key={e.id}>
                <div className="group flex items-center gap-3 px-4 py-2.5">
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

                  <button
                    onClick={() => setOpen(isOpen ? null : e.id)}
                    aria-expanded={isOpen}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm capitalize">{e.name}</span>
                      {e.source === "AI" && (
                        // The user needs to know which numbers are a model's guess vs lab data.
                        <span
                          title="Estimated by AI — not from a nutrition database"
                          className="flex shrink-0 items-center gap-0.5 rounded bg-surface-2 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted"
                        >
                          <Sparkles className="size-2.5" />
                          est
                        </span>
                      )}
                      {e.source === "OFF" && (
                        <Barcode
                          className="size-3 shrink-0 text-muted"
                          aria-label="From the manufacturer's label"
                        />
                      )}
                      <ChevronDown
                        className={`ml-auto size-3.5 shrink-0 text-muted transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                    <div className="mt-1">
                      <MacroLine n={e} />
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
                    <input
                      type="number"
                      inputMode="numeric"
                      defaultValue={round(e.grams, 0)}
                      min={1}
                      max={5000}
                      aria-label={`Grams of ${e.name}`}
                      onBlur={(ev) => {
                        const g = Number(ev.target.value);
                        if (g > 0 && g !== round(e.grams, 0)) onGramsChange(e.id, g);
                        else ev.target.value = String(round(e.grams, 0));
                      }}
                      className="w-11 rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono tabular-nums hover:border-border focus:border-border focus:outline-none"
                    />
                    <span>g</span>
                  </div>

                  <span className="w-11 shrink-0 text-right font-mono text-sm tabular-nums">
                    {round(e.kcal, 0)}
                  </span>

                  <button
                    onClick={() => onDelete(e.id)}
                    aria-label={`Remove ${e.name}`}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition hover:text-[var(--over)]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {isOpen && <NutritionDetail n={e} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
