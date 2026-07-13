import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseMealText } from "@/lib/ai/parse";
import { resolveItems } from "@/lib/nutrition/resolve";
import { requireUser } from "@/lib/user";

const bodySchema = z.object({ text: z.string().min(1).max(1000) });

/// Text → items with nutrition attached. Nothing is saved: the client shows these in the
/// review sheet so the user can fix portions before committing via POST /api/entries.
///
/// Auth-gated even though it touches no user data — it spends real money on every call
/// (model tokens, USDA quota), so leaving it open is an open invitation to run up the bill.
export async function POST(request: NextRequest) {
  const { res: unauthed } = await requireUser();
  if (unauthed) return unauthed;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Type what you ate" }, { status: 400 });
  }

  try {
    const items = await parseMealText(parsed.data.text);
    if (items.length === 0) {
      return Response.json({ error: "Couldn't find any food in that" }, { status: 422 });
    }
    return Response.json({ items: await resolveItems(items) });
  } catch (err) {
    console.error("parse failed", err);
    return Response.json({ error: "Couldn't read that meal. Try again?" }, { status: 502 });
  }
}
