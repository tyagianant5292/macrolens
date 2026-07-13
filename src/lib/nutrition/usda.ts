import { per100gSchema, type Micros, type Per100g } from "./types";

/// USDA FoodData Central. Free key: https://fdc.nal.usda.gov/api-key-signup
/// DEMO_KEY works without signup but is aggressively rate-limited — fine for a first run.
const API_KEY = process.env.USDA_API_KEY ?? "DEMO_KEY";
const SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

/// Only these datasets report nutrition per 100g. Branded foods report per serving with
/// a different shape, so they're excluded — Open Food Facts covers packaged food better.
const DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];

/// USDA nutrient IDs → our field names. These IDs are stable across the dataset.
const MACRO_IDS: Record<number, keyof Omit<Per100g, "micros">> = {
  1008: "kcal", // Energy
  1003: "protein",
  1005: "carbs", // Carbohydrate, by difference
  1004: "fat", // Total lipid
  1079: "fiber", // Fiber, total dietary
  2000: "sugar", // Sugars, total
};

const MICRO_IDS: Record<number, keyof Micros> = {
  1089: "iron",
  1087: "calcium",
  1090: "magnesium",
  1092: "potassium",
  1093: "sodium",
  1095: "zinc",
  1106: "vitaminA", // Vitamin A, RAE
  1162: "vitaminC",
  1114: "vitaminD", // Vitamin D (D2 + D3)
  1178: "vitaminB12",
  1177: "folate",
  1253: "cholesterol",
};

type UsdaNutrient = { nutrientId?: number; value?: number };
type UsdaFood = { description?: string; foodNutrients?: UsdaNutrient[] };

export type UsdaHit = { displayName: string; per100g: Per100g };

/// How many candidates to pull back. USDA ranks purely on text similarity, and its top hit
/// for a plain food name is regularly the wrong food entirely — "banana" ranks banana chips
/// (346 kcal/100g) above the fruit (89), and "oats" ranks oat milk (45) above oats (379).
/// The right row is almost always in the first few, so we fetch a handful and let the
/// caller choose. Taking hit #1 on faith is what made USDA *less* accurate than guessing.
const CANDIDATES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/// api.data.gov throttles bursts, and it does it with a 400 rather than a 429 — so a photo
/// resolving six foods at once gets a couple of them rejected for no reason to do with the
/// query. Left unhandled that's invisible: lookupUsda returns null, the food silently falls
/// through to the AI estimator, and you never find out you had real data available.
/// Retrying clears it; the same query that 400s comes back 200 a moment later.
async function fetchWithRetry(url: URL, attempts = 3): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      // 404 is a real "not in the database" — don't waste retries on it.
      if (res.ok || res.status === 404) return res;
    } catch {
      // network blip; fall through to the backoff
    }
    if (i < attempts - 1) await sleep(300 * 2 ** i);
  }
  return null;
}

function toHit(food: UsdaFood, fallbackName: string): UsdaHit | null {
  if (!food.foodNutrients?.length) return null;

  const macros: Partial<Record<keyof Omit<Per100g, "micros">, number>> = {};
  const micros: Micros = {};

  for (const n of food.foodNutrients) {
    if (n.nutrientId === undefined || typeof n.value !== "number") continue;
    const macroKey = MACRO_IDS[n.nutrientId];
    if (macroKey) {
      macros[macroKey] = n.value;
      continue;
    }
    const microKey = MICRO_IDS[n.nutrientId];
    if (microKey) micros[microKey] = n.value;
  }

  // A row with no energy value is junk — drop it so it can't be chosen.
  if (macros.kcal === undefined) return null;

  const parsed = per100gSchema.safeParse({ ...macros, micros });
  if (!parsed.success) return null;

  return {
    displayName: food.description?.toLowerCase() ?? fallbackName,
    per100g: parsed.data,
  };
}

/// Search USDA and return the top few usable candidates, in USDA's own ranking order.
/// Deliberately does NOT choose between them — see CANDIDATES above for why that's the
/// caller's job. Returns [] on no match, a bad key, or exhausted retries; callers fall
/// back to the AI estimator, so failure here is degradation, not an error.
export async function searchUsda(query: string): Promise<UsdaHit[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(CANDIDATES));
  for (const t of DATA_TYPES) url.searchParams.append("dataType", t);

  const res = await fetchWithRetry(url);
  if (!res?.ok) return [];

  const data = (await res.json()) as { foods?: UsdaFood[] };
  return (data.foods ?? [])
    .map((f) => toHit(f, query))
    .filter((h): h is UsdaHit => h !== null);
}
