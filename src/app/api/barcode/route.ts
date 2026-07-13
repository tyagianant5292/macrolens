import type { NextRequest } from "next/server";
import { lookupBarcode } from "@/lib/nutrition/openfoodfacts";
import { scaleToGrams } from "@/lib/nutrition/types";
import { requireUser } from "@/lib/user";

/// Barcode → a single draft item, in the same shape /api/parse returns, so the review sheet
/// doesn't care which of the three inputs produced it.
export async function GET(request: NextRequest) {
  const { res } = await requireUser();
  if (res) return res;

  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  // EAN-8 through EAN-13/UPC. Rejecting junk here saves a pointless round-trip to OFF.
  if (!/^\d{8,14}$/.test(code)) {
    return Response.json({ error: "That doesn't look like a barcode" }, { status: 400 });
  }

  const hit = await lookupBarcode(code);
  if (!hit) {
    return Response.json(
      { error: "Not in Open Food Facts — add it by typing the food instead" },
      { status: 404 },
    );
  }

  const grams = hit.servingGrams ?? 100;

  return Response.json({
    items: [
      {
        name: hit.name,
        quantity: 1,
        unit: hit.servingGrams ? "serving" : "g",
        grams,
        ...scaleToGrams(hit.per100g, grams),
        // The manufacturer's own label — not a guess, so no "est" badge and no confidence.
        source: "OFF",
        confidence: null,
      },
    ],
    barcode: code,
  });
}
