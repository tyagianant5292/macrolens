import { createOpenAI } from "@ai-sdk/openai";

/// The whole AI provider lives in four env vars. Nothing about a vendor, a host, or a model
/// name is baked into this repo — switching from a self-hosted gateway to Groq to OpenAI is
/// an .env edit, not a code change.
///
///   AI_BASE_URL      https://api.groq.com/openai/v1   |  https://api.openai.com/v1  |  your gateway
///   AI_API_KEY       the key for that endpoint
///   AI_TEXT_MODEL    the model that parses "2 roti, ek katori dal" into items
///   AI_VISION_MODEL  the model that reads a photo of a plate
///
/// Any endpoint that speaks OpenAI's /chat/completions works, which is nearly all of them.
///
/// Whatever you pick, BOTH models must support enforced `json_schema` output and the vision
/// one must accept image input. That is not a formality — every call in this app is structured
/// output, and a model that accepts the schema and then ignores it produces confidently wrong
/// nutrition rather than an error. Test before you switch.
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fail loudly at the first call rather than sending `undefined` to the provider and
    // getting back an opaque 401 twenty minutes later.
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill in AI_BASE_URL, AI_API_KEY, ` +
        `AI_TEXT_MODEL and AI_VISION_MODEL for whichever provider you're using.`,
    );
  }
  return value;
}

/// Built lazily: reading env at module scope would blow up `next build`, which imports this
/// file without any of the runtime secrets present.
function provider() {
  return createOpenAI({
    baseURL: required("AI_BASE_URL"),
    apiKey: required("AI_API_KEY"),
  });
}

/// `.chat()`, not the default `provider(id)`. The default factory targets OpenAI's Responses
/// API, which Groq and most self-hosted gateways don't implement — Chat Completions is the
/// common denominator everything speaks.
export const textModel = () => provider().chat(required("AI_TEXT_MODEL"));
export const visionModel = () => provider().chat(required("AI_VISION_MODEL"));

/// Shared context so the model estimates Indian portions sensibly. Without this it
/// defaults to US serving sizes and a katori of dal comes back as 2 cups.
export const PORTION_GUIDE = `
Portion reference (use these unless the user or photo clearly says otherwise):
- 1 roti / chapati / phulka ≈ 40g
- 1 paratha (plain) ≈ 65g
- 1 katori (small bowl) of dal / sabzi / curry ≈ 150g
- 1 katori cooked rice ≈ 150g
- 1 medium idli ≈ 40g, 1 dosa ≈ 90g
- 1 large egg ≈ 50g
- 1 scoop whey protein ≈ 30g
- 1 medium banana ≈ 120g, 1 medium apple ≈ 180g
- 1 cup milk ≈ 240g

When the user describes a portion in pieces or bowls ("2 roti", "ek katori dal"), convert to
the cooked, as-eaten weight. Rice and dal roughly triple in weight when cooked.

But when the user states a weight outright ("50g oats", "200g chicken"), that number IS the
weight — never convert it, and describe the food in the state they weighed it in. People
weigh oats, rice, pasta and protein powder DRY, so "50g oats" is 50g of dry oats
(usdaQuery: "oats, rolled, dry"), not 50g of cooked porridge. Getting this backwards
undercounts a breakfast by a factor of five.
`.trim();
