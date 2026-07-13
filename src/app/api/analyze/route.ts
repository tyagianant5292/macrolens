import type { NextRequest } from "next/server";
import { analysePhoto } from "@/lib/ai/parse";
import { resolveItems } from "@/lib/nutrition/resolve";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

/// The client downscales to ~1024px before upload, so anything near this is a client that
/// didn't. Keep it well under the model's limits and Postgres's comfort zone.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/// Photo → items with nutrition attached, plus the stored photo's id.
///
/// The photo is saved here rather than at save-time so that the id can be handed to the review
/// sheet and come back on POST /api/entries. If the user abandons the review sheet the Photo
/// row is orphaned — harmless, and cheaper than the alternative of re-uploading the bytes.
export async function POST(request: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;

  const form = await request.formData();
  const file = form.get("image");
  const hint = form.get("hint");

  if (!(file instanceof File)) {
    return Response.json({ error: "No photo received" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Photo is too large" }, { status: 413 });
  }
  if (!ALLOWED.includes(file.type)) {
    return Response.json({ error: `Unsupported image type: ${file.type}` }, { status: 415 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const items = await analysePhoto(
      bytes.toString("base64"),
      file.type,
      typeof hint === "string" ? hint : undefined,
    );

    if (items.length === 0) {
      return Response.json({ error: "No food spotted in that photo" }, { status: 422 });
    }

    const [photo, resolved] = await Promise.all([
      prisma.photo.create({
        data: { userId: user.id, mediaType: file.type, bytes },
        select: { id: true },
      }),
      resolveItems(items),
    ]);

    return Response.json({ items: resolved, photoId: photo.id });
  } catch (err) {
    console.error("analyze failed", err);
    return Response.json({ error: "Couldn't read that photo. Try again?" }, { status: 502 });
  }
}
