import { z } from "zod";

/// The micronutrients we bother tracking. Anything outside this list gets dropped —
/// USDA returns 100+ nutrients per food and almost none of them are actionable.
export const TRACKED_MICROS = {
  iron: "mg",
  calcium: "mg",
  magnesium: "mg",
  potassium: "mg",
  sodium: "mg",
  zinc: "mg",
  vitaminA: "µg",
  vitaminC: "mg",
  vitaminD: "µg",
  vitaminB12: "µg",
  folate: "µg",
  cholesterol: "mg",
} as const;

export type MicroKey = keyof typeof TRACKED_MICROS;

export const microsSchema = z
  .object(
    Object.fromEntries(
      Object.keys(TRACKED_MICROS).map((k) => [k, z.number().nonnegative().optional()]),
    ) as Record<MicroKey, z.ZodOptional<z.ZodNumber>>,
  )
  .partial();

export type Micros = Partial<Record<MicroKey, number>>;

/// Nutrition for exactly 100g of a food. The canonical unit everything is stored in —
/// portion maths is always `per100g * (grams / 100)`.
export const per100gSchema = z.object({
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative().default(0),
  sugar: z.number().nonnegative().default(0),
  micros: microsSchema.default({}),
});

export type Per100g = z.infer<typeof per100gSchema>;

/// A food the user ate, before nutrition has been looked up. This is what both the
/// text parser and the photo analyser produce.
/// Field ORDER is load-bearing, not cosmetic. Under strict JSON-schema decoding the model
/// fills these slots largely positionally, so a field inserted mid-schema shifts every value
/// after it: adding `usdaQuery` between `name` and `quantity` produced
/// `{name: "roti", usdaQuery: "2", quantity: 80, unit: "g"}` — the quantity landed in
/// usdaQuery and the grams landed in quantity. Keep the natural name→quantity→unit→grams
/// run intact and append anything new at the end.
export const parsedItemSchema = z.object({
  name: z
    .string()
    .describe("Plain food name, no quantity. e.g. 'roti', 'paneer bhurji', 'boiled egg'"),
  quantity: z.number().positive().describe("How many units, e.g. 2 for '2 roti'"),
  unit: z
    .string()
    .describe("Unit the quantity is in, e.g. 'roti', 'katori', 'g', 'cup', 'piece'"),
  grams: z
    .number()
    .positive()
    .describe("Total cooked weight in grams for the full quantity above"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("How sure you are about the portion size"),
  /// USDA's search ranks on text similarity, so a bare "rice" returns whichever rice row
  /// happens to rank first — it matched "Dirty rice", and "oats" matched "Oat milk".
  /// Making the model spell out the state the food is in is what keeps the lookup honest.
  usdaQuery: z
    .string()
    .describe(
      "The same food written the way a nutrition database would list it, always naming " +
        "the cooked state. e.g. 'rice, white, cooked' / 'lentils, cooked' / " +
        "'chicken breast, roasted, skinless'. For dishes with no database equivalent " +
        "(most Indian dishes), repeat the plain name. Never put a quantity or weight here.",
    ),
});

export type ParsedItem = z.infer<typeof parsedItemSchema>;

/// A ParsedItem with its nutrition resolved. Ready to write to the DB.
export type ResolvedItem = ParsedItem & {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  micros: Micros;
  source: "USDA" | "OFF" | "AI" | "MANUAL";
};

export const MACRO_KEYS = ["kcal", "protein", "carbs", "fat", "fiber", "sugar"] as const;

/// Scale per-100g nutrition to an actual portion.
export function scaleToGrams(per100g: Per100g, grams: number) {
  const f = grams / 100;
  const micros: Micros = {};
  for (const [k, v] of Object.entries(per100g.micros ?? {})) {
    if (typeof v === "number") micros[k as MicroKey] = round(v * f, 2);
  }
  return {
    kcal: round(per100g.kcal * f),
    protein: round(per100g.protein * f),
    carbs: round(per100g.carbs * f),
    fat: round(per100g.fat * f),
    fiber: round(per100g.fiber * f),
    sugar: round(per100g.sugar * f),
    micros,
  };
}

export function round(n: number, dp = 1) {
  const m = 10 ** dp;
  return Math.round(n * m) / m;
}
