"use client";

import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Goal, MealSlot } from "@/lib/api-types";

const FIELDS = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
] as const;

type Props = {
  goal: Goal;
  meals: MealSlot[];
  onClose: () => void;
  onChanged: () => void;
};

export function SettingsSheet({ goal, meals, onClose, onChanged }: Props) {
  const [draft, setDraft] = useState(goal);
  const [savingGoals, setSavingGoals] = useState(false);
  const [newMeal, setNewMeal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sanity check: what the macros actually add up to, so a 400 kcal mismatch is visible.
  const implied = draft.protein * 4 + draft.carbs * 4 + draft.fat * 9;
  const drift = implied - draft.kcal;

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "That didn't work");
        return false;
      }
      onChanged();
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveGoals() {
    setSavingGoals(true);
    await call("/api/goals", {
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
    setSavingGoals(false);
  }

  async function addMeal() {
    const name = newMeal.trim();
    if (!name) return;
    const ok = await call("/api/meals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (ok) setNewMeal("");
  }

  const move = (meal: MealSlot, by: number) =>
    call(`/api/meals/${meal.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order: meal.order + by }),
    });

  const rename = (meal: MealSlot, name: string) =>
    call(`/api/meals/${meal.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-lg px-4">
          <div className="sticky top-0 flex items-center justify-between bg-surface py-4">
            <h2 className="font-semibold">Settings</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X className="size-4" />
            </button>
          </div>

          {error && <p className="mb-3 text-xs text-[var(--over)]">{error}</p>}

          {/* ── Meals ───────────────────────────────────────────────── */}
          <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">Your meals</h3>
          <ul className="space-y-1.5">
            {meals.map((m, i) => (
              <li
                key={m.id}
                className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 pl-3 pr-1.5"
              >
                <input
                  defaultValue={m.name}
                  maxLength={30}
                  aria-label={`Rename ${m.name}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== m.name) rename(m, v);
                    else e.target.value = m.name;
                  }}
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm focus:outline-none"
                />
                <button
                  onClick={() => move(m, -1)}
                  disabled={i === 0 || busy}
                  aria-label={`Move ${m.name} up`}
                  className="grid size-7 place-items-center rounded text-muted hover:text-foreground disabled:opacity-25"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  onClick={() => move(m, 1)}
                  disabled={i === meals.length - 1 || busy}
                  aria-label={`Move ${m.name} down`}
                  className="grid size-7 place-items-center rounded text-muted hover:text-foreground disabled:opacity-25"
                >
                  <ChevronDown className="size-3.5" />
                </button>
                <button
                  onClick={() => call(`/api/meals/${m.id}`, { method: "DELETE" })}
                  disabled={busy}
                  aria-label={`Delete ${m.name}`}
                  className="grid size-7 place-items-center rounded text-muted hover:text-[var(--over)]"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex gap-2">
            <input
              value={newMeal}
              onChange={(e) => setNewMeal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addMeal();
              }}
              maxLength={30}
              placeholder="Tea time, Bed time, Pre-workout…"
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm placeholder:text-muted focus:border-muted focus:outline-none"
            />
            <button
              onClick={addMeal}
              disabled={busy || !newMeal.trim()}
              aria-label="Add meal"
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-muted hover:text-foreground disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            A meal with food logged in it can&apos;t be deleted — remove the food first.
          </p>

          {/* ── Goals ───────────────────────────────────────────────── */}
          <h3 className="mb-2 mt-6 text-xs uppercase tracking-wide text-muted">Daily goals</h3>
          <div className="space-y-1.5">
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

          <p className="mt-2 text-[11px] text-muted">
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

          <button
            onClick={saveGoals}
            disabled={savingGoals}
            className="mt-3 flex w-full items-center justify-center rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
          >
            {savingGoals ? <Loader2 className="size-4 animate-spin" /> : "Save goals"}
          </button>
        </div>
      </div>
    </div>
  );
}
