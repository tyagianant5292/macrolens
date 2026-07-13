import { per100gSchema, type Micros, type Per100g } from "./types";

/// Open Food Facts. Free, no key, ~22k Indian products. Covers packaged goods only — it has
/// nothing to say about a katori of dal, which is exactly why it complements USDA rather than
/// replacing it. Their terms ask for an identifying User-Agent; sending a generic one gets you
/// rate-limited.
const UA = "MacroLens/1.0 (personal diet tracker)";
const URL_FOR = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
  `?fields=product_name,brands,nutriments,serving_size,quantity`;

/// OFF's nutriment keys. `_100g` values are already normalised per 100g/100ml, which is the
/// one thing that makes this source easy — no serving-size maths.
type Nutriments = Record<string, number | string | undefined>;

const MACROS: Record<keyof Omit<Per100g, "micros">, string> = {
  kcal: "energy-kcal_100g",
  protein: "proteins_100g",
  carbs: "carbohydrates_100g",
  fat: "fat_100g",
  fiber: "fiber_100g",
  sugar: "sugars_100g",
};

const MICROS: Partial<Record<keyof Micros, string>> = {
  iron: "iron_100g",
  calcium: "calcium_100g",
  magnesium: "magnesium_100g",
  potassium: "potassium_100g",
  sodium: "sodium_100g",
  zinc: "zinc_100g",
  vitaminA: "vitamin-a_100g",
  vitaminC: "vitamin-c_100g",
  vitaminD: "vitamin-d_100g",
  vitaminB12: "vitamin-b12_100g",
  folate: "folates_100g",
  cholesterol: "cholesterol_100g",
};

/// OFF reports minerals in grams, we track them in mg/µg. Scale on the way in or every
/// packaged food shows 0.0mg iron.
const TO_MG = 1000;
const TO_UG = 1_000_000;
const MICRO_SCALE: Partial<Record<keyof Micros, number>> = {
  iron: TO_MG,
  calcium: TO_MG,
  magnesium: TO_MG,
  potassium: TO_MG,
  sodium: TO_MG,
  zinc: TO_MG,
  vitaminC: TO_MG,
  cholesterol: TO_MG,
  vitaminA: TO_UG,
  vitaminD: TO_UG,
  vitaminB12: TO_UG,
  folate: TO_UG,
};

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

export type OffHit = {
  name: string;
  per100g: Per100g;
  /// Grams in one serving if the label states it — lets us pre-fill a sensible portion
  /// instead of defaulting to a jarring 100g of peanut butter.
  servingGrams: number | null;
};

export async function lookupBarcode(barcode: string): Promise<OffHit | null> {
  let res: Response;
  try {
    res = await fetch(URL_FOR(barcode), {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json()) as {
    status?: number;
    product?: { product_name?: string; brands?: string; nutriments?: Nutriments; serving_size?: string };
  };
  const p = body.product;
  if (body.status !== 1 || !p?.nutriments) return null;

  const macros: Partial<Record<keyof Omit<Per100g, "micros">, number>> = {};
  for (const [key, offKey] of Object.entries(MACROS)) {
    const v = num(p.nutriments[offKey]);
    if (v !== undefined) macros[key as keyof typeof MACROS] = v;
  }
  // No energy value means the product exists but nobody has filled in its nutrition —
  // common on OFF. Treat as a miss so the caller can say so plainly.
  if (macros.kcal === undefined) return null;

  const micros: Micros = {};
  for (const [key, offKey] of Object.entries(MICROS)) {
    const k = key as keyof Micros;
    const v = num(p.nutriments[offKey!]);
    if (v !== undefined) micros[k] = v * (MICRO_SCALE[k] ?? 1);
  }

  const parsed = per100gSchema.safeParse({ ...macros, micros });
  if (!parsed.success) return null;

  // serving_size is free text ("30 g", "1 biscuit (12.5g)"). Take the first gram figure.
  const servingGrams = Number(p.serving_size?.match(/([\d.]+)\s*g/i)?.[1]) || null;

  const brand = p.brands?.split(",")[0]?.trim();
  const name = [brand, p.product_name?.trim()].filter(Boolean).join(" ") || `Barcode ${barcode}`;

  return { name, per100g: parsed.data, servingGrams };
}
