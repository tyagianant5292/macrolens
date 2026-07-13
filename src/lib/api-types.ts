import type { Totals } from "./totals";
import type { Micros } from "./nutrition/types";

export const MEALS = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABELS: Record<Meal, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  SNACK: "Snacks",
  DINNER: "Dinner",
};

export type Source = "USDA" | "OFF" | "AI" | "MANUAL";

/// A saved entry, as returned by GET /api/day.
export type Entry = {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  micros: Micros | null;
  source: Source;
  confidence: string | null;
  photoId: string | null;
  barcode: string | null;
};

/// An item that's been parsed and priced but not yet saved — what the review sheet edits.
export type DraftItem = Omit<
  Entry,
  "id" | "date" | "meal" | "photoId" | "barcode" | "micros"
> & {
  micros: Micros;
};

/// What /api/parse, /api/analyze and /api/barcode all return. Three very different inputs,
/// one shape — so the review sheet doesn't care which produced it.
export type DraftResponse = {
  items: DraftItem[];
  photoId?: string;
  barcode?: string;
};

export type Goal = {
  id: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type DayResponse = {
  date: string;
  entries: Entry[];
  totals: Totals;
  goal: Goal;
};

export type { Totals };
