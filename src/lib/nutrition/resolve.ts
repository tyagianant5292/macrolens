import { generateText, Output } from "ai";
import { z } from "zod";
import { textModel } from "../ai/model";
import { prisma } from "../prisma";
import { searchUsda, type UsdaHit } from "./usda";
import {
  per100gSchema,
  scaleToGrams,
  type Micros,
  type ParsedItem,
  type Per100g,
  type ResolvedItem,
} from "./types";

/// Cache key. "  2 Rotis! " and "roti" must collide, or the cache never hits.
export function normaliseFoodKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s$/, ""); // crude de-pluralisation: "eggs" → "egg"
}

/// Last resort when the food isn't in cache or USDA — mostly Indian dishes, which USDA
/// barely covers. These numbers are the model's recall, not measurements, so everything
/// that comes out of here is tagged AI and badged "estimated" in the UI.
///
/// Two things here are load-bearing, both learned the hard way:
///
/// 1. NO portion guide in this prompt. It looks harmless — it's the same guide the parser
///    uses — but it is a table of serving weights, and including it makes the model answer
///    per *serving* while still calling it per 100g. With the guide, "roti" came back as
///    115 kcal/100g (which is one 40g roti's calories); without it, 264. Real value ~297.
///
/// 2. Ask with the descriptive `usdaQuery`, not the bare name. "roti" is ambiguous;
///    "roti (chapati, whole wheat, cooked)" is not, and the answer tightens accordingly.
async function estimateWithAi(query: string) {
  const { output } = await generateText({
    model: textModel(),
    output: Output.object({ schema: per100gSchema }),
    system: `Give the nutrition of the named food per 100g, as commonly prepared.
Assume typical home cooking (some oil, some salt) unless the name says otherwise.
Micronutrient amounts are in the units given; omit any you're not reasonably sure of.

Answer per 100g of the food, NOT per serving or per piece.`,
    prompt: query,
  });
  return output;
}

/// USDA hands back its candidates ranked by text similarity, which is exactly the thing that
/// gets "banana" wrong. The model, shown the descriptions side by side, has no trouble
/// telling "Bananas, raw" from "Snacks, banana chips" — so it picks, and it's allowed to
/// say none of them are the food in question, which is the common case for Indian dishes.
async function pickUsdaMatch(food: string, candidates: UsdaHit[]): Promise<UsdaHit | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const list = candidates
    .map((c, i) => `${i}. ${c.displayName} (${Math.round(c.per100g.kcal)} kcal/100g)`)
    .join("\n");

  const { output } = await generateText({
    model: textModel(),
    output: Output.object({
      schema: z.object({
        index: z
          .number()
          .int()
          .describe("Index of the row that is the same food, or -1 if none of them are"),
      }),
    }),
    system: `You are matching a food to rows from a nutrition database.

Pick the row that is THE SAME FOOD, prepared the same way. Reject rows that are a different
food that merely shares a word: banana chips are not a banana, oat milk is not oats, a soup
made with lentils is not lentils. A raw row is not a match for a cooked food, or vice versa.

If none of the rows is the same food, answer -1. Answering -1 is much better than picking a
row that is merely related — a wrong match silently poisons the user's calorie count.`,
    prompt: `Food: ${food}\n\nRows:\n${list}`,
  });

  return candidates[output.index] ?? null;
}

type CachedFood = {
  displayName: string;
  per100g: Per100g;
  source: "USDA" | "AI";
};

/// Cache → USDA → AI. Every successful resolution is written back to FoodCache, so a food
/// you eat often costs one lookup ever, then a DB read forever after.
///
/// `usdaQuery` is the parser's database-shaped rendering of the same food ("rice, white,
/// cooked"); `name` is what the user sees and what we key the cache on.
async function resolveFood(name: string, usdaQuery: string): Promise<CachedFood> {
  const key = normaliseFoodKey(name);

  const cached = await prisma.foodCache.findUnique({ where: { key } });
  if (cached) {
    return {
      displayName: cached.displayName,
      per100g: per100gSchema.parse({
        kcal: cached.kcal,
        protein: cached.protein,
        carbs: cached.carbs,
        fat: cached.fat,
        fiber: cached.fiber,
        sugar: cached.sugar,
        micros: (cached.micros as Micros | null) ?? {},
      }),
      source: cached.source === "USDA" ? "USDA" : "AI",
    };
  }

  const usda = await pickUsdaMatch(usdaQuery, await searchUsda(usdaQuery));
  const resolved: CachedFood = usda
    ? // Keep the user's word for it. USDA descriptions read like "Rice, white, glutinous,
      // unenriched, cooked" — accurate, and useless in a list of what you ate today.
      { ...usda, displayName: name, source: "USDA" }
    : {
        displayName: name,
        per100g: await estimateWithAi(usdaQuery),
        source: "AI",
      };

  const row = {
    displayName: resolved.displayName,
    source: resolved.source,
    ...resolved.per100g,
    micros: resolved.per100g.micros,
  };
  // upsert, not create: two entries added in the same second would race on the unique key.
  await prisma.foodCache.upsert({ where: { key }, create: { key, ...row }, update: row });

  return resolved;
}

/// Resolving all of a photo's foods at once means firing every USDA lookup simultaneously,
/// and USDA throttles that burst — so a plate with six items would lose two of them to the
/// AI estimator for no reason. Three at a time is enough to stay quick without tripping it.
const USDA_CONCURRENCY = 3;

/// Turn parsed items into fully-costed entries.
export async function resolveItems(items: ParsedItem[]): Promise<ResolvedItem[]> {
  const out: ResolvedItem[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      const food = await resolveFood(item.name, item.usdaQuery);
      out[i] = {
        ...item,
        ...scaleToGrams(food.per100g, item.grams),
        source: food.source,
      };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(USDA_CONCURRENCY, items.length) }, worker),
  );
  return out;
}
