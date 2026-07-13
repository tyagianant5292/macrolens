import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

/// Serve a meal photo back to its owner.
///
/// The `userId` in the where-clause is the whole point: photo ids are guessable-ish cuids, and
/// without it any signed-in user could read anyone's meal photos by iterating ids. A miss 404s
/// rather than 403s, so this also doesn't confirm whether an id exists.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (res) return res;

  const { id } = await ctx.params;
  const photo = await prisma.photo.findFirst({
    where: { id, userId: user.id },
    select: { bytes: true, mediaType: true },
  });
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "content-type": photo.mediaType,
      // Immutable: a photo's bytes never change, only whether it exists. Private, because
      // this is someone's dinner and it must never land in a shared cache.
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
