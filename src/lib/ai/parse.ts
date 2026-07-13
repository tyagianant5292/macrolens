import { generateText, Output } from "ai";
import { z } from "zod";
import { parsedItemSchema, type ParsedItem } from "../nutrition/types";
import { PORTION_GUIDE, textModel, visionModel } from "./model";

const itemsSchema = z.object({ items: z.array(parsedItemSchema) });

/// Free text → structured food items. "2 roti, ek katori dal aur 150g chawal" becomes
/// three items with gram weights. Nutrition is NOT looked up here — that's resolve()'s job.
export async function parseMealText(text: string): Promise<ParsedItem[]> {
  const { output } = await generateText({
    model: textModel(),
    output: Output.object({ schema: itemsSchema }),
    system: `You convert a description of a meal into structured food items.
The user may write in English, Hindi, or Hinglish. Always output food names in English.
Split combined dishes into their components only when they'd have very different nutrition
(e.g. "rajma chawal" → rajma + rice). Keep composite dishes like "paneer bhurji" as one item.

For "2 roti" the fields are: name="roti", quantity=2, unit="roti", grams=80,
usdaQuery="roti (chapati, whole wheat, cooked)". Note that quantity is the count the user
said (2), NOT the weight — grams carries the weight.

${PORTION_GUIDE}`,
    prompt: text,
  });

  return output.items;
}

/// Photo of a plate → structured food items with estimated portions. The model is told to
/// use visible references (plate rim, spoon, hand) for scale and to flag its own uncertainty,
/// because portion size is where photo estimates go wrong, not food identification.
export async function analysePhoto(
  imageBase64: string,
  mediaType: string,
  hint?: string,
): Promise<ParsedItem[]> {
  const { output } = await generateText({
    model: visionModel(),
    output: Output.object({ schema: itemsSchema }),
    system: `You are a nutritionist reading a photo of a meal.

List every distinct food you can see. For each one estimate the cooked weight in grams.
Use the plate rim (a dinner plate is ~27cm), cutlery, or hands in frame to judge scale.

Set confidence honestly:
- "high": food is unambiguous and a clear scale reference is visible
- "medium": food is clear but the portion is a judgement call
- "low": food is partly hidden, or you're guessing at what it is

Do not invent foods you cannot see. If the photo has no food in it, return an empty list.

${PORTION_GUIDE}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: hint?.trim()
              ? `What's on this plate? The user adds: "${hint.trim()}"`
              : "What's on this plate, and how much of each?",
          },
          // AI SDK v7: the `image` part is deprecated — images go through `file`.
          { type: "file", mediaType, data: imageBase64 },
        ],
      },
    ],
  });

  return output.items;
}
