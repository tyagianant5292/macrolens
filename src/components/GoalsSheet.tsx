"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";
import type { Goal } from "@/lib/api-types";

const FIELDS = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
] as const;

type Props = {
  goal: Goal;
  onClose: () => void;
  onSaved: () => void;
};

export function GoalsSheet({ goal, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState(goal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rough sanity check: kcal implied by the macros, so you notice a 400 kcal mismatch.
  const implied = draft.protein * 4 + draft.carbs * 4 + draft.fat * 9;
  const drift = implied - draft.kcal;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kcal: draft.kcal,
          protein: draft.protein,
          carbs: draft.carbs,
          fat: draft.fat,
          fiber: draft.fiber,
        }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError("Couldn't save those goals");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-t-2xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-lg px-4">
          <div className="flex items-center justify-between py-4">
            <h2 className="font-semibold">Daily goals</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-2">
            {FIELDS.map((f) => (
              <label
                key={f.key}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2.5"
              >
                <span className="text-sm">{f.label}</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={draft[f.key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [f.key]: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-20 rounded border border-border bg-surface px-2 py-1 text-right font-mono text-sm tabular-nums focus:border-muted focus:outline-none"
                  />
                  <span className="w-8 text-xs text-muted">{f.unit}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-muted">
            Your macros add up to{" "}
            <span className="font-mono tabular-nums text-foreground">{implied} kcal</span>
            {Math.abs(drift) > 50 && (
              <span className="text-amber-400">
                {" "}
                — {Math.abs(drift)} {drift > 0 ? "more" : "less"} than your calorie goal
              </span>
            )}
            .
          </p>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save goals"}
          </button>
        </div>
      </div>
    </div>
  );
}
