# MacroLens

Log what you eat by typing it or photographing the plate. Get macros, micros, per-meal and
per-day totals against your goals.

Built for tracking a gym diet, so it assumes Indian portions by default ("2 roti, ek katori
dal" parses correctly) and it always tells you which numbers it actually knows versus which
ones it guessed.

## How a meal gets logged

```
"2 roti, ek katori dal"  ──┐
                           ├──► LLM ──► [{name, quantity, unit, grams, confidence}]
photo of a plate  ─────────┘                           │
                                                       ▼
                                    for each item:  FoodCache  (seen it before?)
                                                       ↓ miss
                                                    USDA FDC   (real lab values)
                                                       ↓ miss
                                                    LLM guess  (badged "est" in the UI)
                                                       ▼
                                          review sheet — you fix the portions
                                                       ▼
                                                    saved
```

The split matters. The model is good at *identifying* food and *estimating portion size*; it
is not a nutrition database. So it only ever does those two jobs, and the gram-for-gram
nutrition comes from USDA FoodData Central wherever a match exists. When it doesn't — which is
most Indian dishes — the model's estimate is used and the entry is badged `est`, because a
guessed 30g of protein should not look the same as a measured one.

Every resolved food is written to `FoodCache`, so the second time you eat rajma it costs a
database read instead of an API call.

## Setup

Needs **Node 22+** (`nvm use 22`).

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, AI_BASE_URL, AI_API_KEY
npm run db:deploy         # apply the schema
npm run dev
```

**Database** — any Postgres; [Neon](https://neon.tech)'s free tier is plenty. For a throwaway
local one, run `npx prisma dev` in a second terminal and paste the `DATABASE_URL` it prints into
`.env` — but note that `prisma dev`'s server doesn't get on with `migrate deploy`, so use
`npm run db:push` against that one.

**Auth** — Clerk. In development you can leave the keys out entirely: it starts in keyless mode
and prints a link to claim a dev instance. **Production needs real keys.**

**Model — nothing is hardcoded.** No vendor, host or model name appears anywhere in `src/`.
The provider is four environment variables:

```env
AI_BASE_URL      # https://api.groq.com/openai/v1  |  https://api.openai.com/v1  |  your gateway
AI_API_KEY
AI_TEXT_MODEL    # parses "2 roti, ek katori dal" into items
AI_VISION_MODEL  # reads a photo of a plate
```

Any endpoint that speaks OpenAI's `/chat/completions` works, which is nearly all of them —
Groq, OpenAI, a self-hosted vLLM gateway. Switching between them is an `.env` edit.

**The one hard requirement:** both models must support enforced `json_schema` output, and the
vision one must accept image input. Every call in this app is structured output, so a model
that accepts the schema and then ignores it hands you confidently wrong nutrition rather than
an error — which is far worse than failing. When this was built, of four candidate models on
one gateway, two returned HTTP 500 on any image and a third answered in Markdown while
claiming to honour the schema. **Test a photo and a text parse before trusting a new provider.**

**USDA key** is optional but worth the 30 seconds:
[fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup). Without it the app
uses USDA's shared `DEMO_KEY`, which is rate-limited hard enough that you *will* hit it in an
afternoon's testing — at which point every food silently falls through to the AI estimator.

## Four things that will bite you if you touch this

Every one was found by measuring against published values, not by reading the output and
nodding — each looked completely fine in the response JSON.

**Never take USDA's top hit on faith.** Its search ranks on text similarity, so `banana`
returns *banana chips* (346 kcal/100g vs the fruit's 89), `oats` returns *oat milk* (45 vs 379)
and `rice` returns *Dirty rice*. Ranked first, every time. Taking hit #1 made USDA **less**
accurate than just asking the model. So `searchUsda` pulls the top 5 and `pickUsdaMatch` has
the model choose — it can tell "Bananas, raw" from "Snacks, banana chips" instantly — with -1
meaning "none of these are the food", which is the common case for Indian dishes.

**Field order in `parsedItemSchema` is load-bearing.** Under strict-schema decoding the model
fills slots substantially by position, so inserting `usdaQuery` between `name` and `quantity`
shifted every value after it: `{name: "roti", usdaQuery: "2", quantity: 80, unit: "g"}` — the
count landed in usdaQuery, the grams in quantity. Nothing errored; the JSON validated. Keep the
name→quantity→unit→grams run intact and append new fields at the **end**.

**Don't let the portion guide near the nutrition estimator.** It's a table of serving weights
("1 roti ≈ 40g"), and including it makes the model answer per *serving* while still labelling it
per 100g. With the guide, `roti` resolved to 115 kcal/100g — almost exactly one 40g roti's
calories. Without it: 264. The parser needs that guide; the estimator must not see it.

**An explicit weight is never converted.** People weigh oats, rice and protein powder *dry*, so
"50g oats" is 50g of dry oats (379 kcal/100g), not 50g of cooked porridge (71). A blanket
"always report cooked weight" rule undercounts that breakfast fivefold. Pieces and bowls get
converted to cooked weight; stated grams are taken as given.

Measured after all four, per 100g against published values:

| | roti | dal | rice | chicken breast | banana | oats | egg | paneer |
|---|---|---|---|---|---|---|---|---|
| **error** | 1% | 0% | 0% | 7% | 0% | 0% | 0% | 13% |

## Deploying

Vercel. Set these in the project's environment variables, then push:

| Variable | |
| --- | --- |
| `DATABASE_URL` | Neon connection string |
| `AI_BASE_URL`, `AI_API_KEY` | your OpenAI-compatible endpoint |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | **required** — keyless mode is dev-only |
| `USDA_API_KEY` | optional but strongly advised |

Run `npm run db:deploy` once against the production `DATABASE_URL` to create the tables. It is
deliberately *not* in the build script: a migration failure would then take the whole deploy
down with it, and this app's schema changes about once a month.

`prisma generate` **is** in the build script and must stay there — the generated client is
gitignored, so a fresh clone has no `src/generated/` and the build fails without it.

## Install it on your phone

It's a PWA. Open the deployed URL in Safari (iPhone) or Chrome (Android), then **Share → Add to
Home Screen**. It gets an icon, runs full-screen with no browser chrome, and the photo button
opens the camera directly.

Two things only work over HTTPS, so they'll be dead on `localhost` from your phone but fine on
the deployed URL: the camera (photo + barcode) and the install prompt itself.

## Why USDA and not an Indian database

Evaluated and rejected, so nobody re-litigates it:

**FSSAI is not an option.** It's a regulator — labelling rules, RDA values, FBO licensing. It
publishes no food-composition database and no API, and its own labelling guidance points
industry at IFCT for the actual numbers.

**IFCT 2017 (ICMR-NIN)** is India's authoritative table, but it's a PDF of **528 raw,
ingredient-level foods** — not cooked dishes — and its copyright notice requires written
permission from NIN to store the values electronically in a product. The digitized
`@nodef/ifct2017` package is AGPL-3.0, which would force this app open-source and still
wouldn't resolve NIN's underlying rights.

**INDB** (Indian Nutrient Databank, ICMR-derived, peer-reviewed) is the one genuinely
attractive option: **1,014 cooked Indian recipes** with cooking losses already applied. It's a
downloadable XLSX with no API and no LICENSE file. If this ever needs long-tail Indian dishes
(chole, poha, upma, biryani) it is the thing to seed — and `FoodCache` is the first lookup in
the chain, so seeding it needs **no new code path**, just rows. Clear the licence with the
authors first.

Not done because the measured error on the staples this app actually sees is already 0–13%
(table above), and the AI fallback covers the tail acceptably. Revisit if the tail starts
lying to you.

## Auth

Clerk, and **protection lives on the resource, not in the proxy**. Every API route's first line
is `requireUser()`; `page.tsx` redirects on the server. `src/proxy.ts` only attaches Clerk's
auth context.

That's deliberate and Clerk now recommends it: middleware-based `auth.protect()` matches on
paths, and path matching diverges from how Next actually routes. When this app used it, the
route matcher 404'd *the entire app including the sign-in page*. Resource-based checks can't
drift, because the check sits where the data is.

The cost is that a new route is unguarded until it says otherwise — `/api/parse` shipped open
for exactly that reason, and it spends money on every call. **If you add a route, guard it.**
`find src/app/api -name route.ts | xargs grep -L requireUser` should print nothing.

## Deliberately not here yet

- **No weight tracking**, so no "are you actually gaining" trend. It's the obvious next thing.
- **Photos live in Postgres**, not object storage — a downscaled plate is ~80KB and this is a
  single-digit-user app, so a bucket would be pure ceremony. `FoodEntry.photoUrl` exists for the
  day that stops being true; swap `Photo` for Vercel Blob and nothing else changes.
- **Barcode lookups are Open Food Facts only.** Great on packaged food, useless on a katori of
  dal — which is the point; it complements USDA rather than competing with it.

## Layout

| Path | What's in it |
| --- | --- |
| `src/lib/ai/` | Model config, portion guide, text parser, photo analyser |
| `src/lib/nutrition/resolve.ts` | The cache → USDA → AI chain |
| `src/lib/nutrition/usda.ts` | FoodData Central lookup + nutrient ID mapping |
| `src/app/api/parse`, `api/analyze` | Text and photo → priced items (saves nothing) |
| `src/app/api/entries` | Commit reviewed items; edit and delete them |
| `src/components/AddSheet.tsx` | The input → analyse → review → save flow |
| `src/lib/user.ts` | `requireUser()` — the only thing between one food log and everyone else's |
| `src/components/WeekChart.tsx` | Weekly bars vs goal, as small multiples |

## The chart palette was computed, not chosen

`--kcal/--protein/--carbs/--fat/--fiber` in `globals.css` come from running the dataviz
palette validator against the two dark surfaces, not from picking nice-looking hues. The
originals *were* picked by eye and every one of them failed the lightness band for a dark
surface (OKLCH L 0.69–0.84 against a required 0.48–0.67) — which is exactly why they looked
washed out.

The surviving set's worst colourblind pair (fiber↔carbs, ΔE 10.7 under protanopia) sits in the
floor band, which is only acceptable **because colour never carries identity here**: every
macro bar is direct-labelled ("Protein 120/150g") and the weekly charts are small multiples
with their own headings. If you ever build a legend-only chart off these, that stops being
true and the palette has to be re-derived.
