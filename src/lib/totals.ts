import { round, TRACKED_MICROS, type MicroKey, type Micros } from "./nutrition/types";

export type Totals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  micros: Micros;
};

type Summable = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  micros?: unknown;
};

export const EMPTY_TOTALS: Totals = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  micros: {},
};

export function sumEntries(entries: Summable[]): Totals {
  const t: Totals = { ...EMPTY_TOTALS, micros: {} };

  for (const e of entries) {
    t.kcal += e.kcal;
    t.protein += e.protein;
    t.carbs += e.carbs;
    t.fat += e.fat;
    t.fiber += e.fiber;
    t.sugar += e.sugar;

    // micros is a Json column, so it's `unknown` until we check it.
    const micros = e.micros;
    if (!micros || typeof micros !== "object") continue;
    for (const key of Object.keys(TRACKED_MICROS) as MicroKey[]) {
      const v = (micros as Record<string, unknown>)[key];
      if (typeof v === "number") t.micros[key] = (t.micros[key] ?? 0) + v;
    }
  }

  t.kcal = round(t.kcal, 0);
  t.protein = round(t.protein);
  t.carbs = round(t.carbs);
  t.fat = round(t.fat);
  t.fiber = round(t.fiber);
  t.sugar = round(t.sugar);
  for (const k of Object.keys(t.micros) as MicroKey[]) {
    t.micros[k] = round(t.micros[k]!, 1);
  }

  return t;
}
