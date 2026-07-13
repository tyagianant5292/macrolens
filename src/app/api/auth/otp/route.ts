import type { NextRequest } from "next/server";
import { z } from "zod";
import { requestOtp } from "@/lib/otp";

const schema = z.object({ email: z.email() });

/// Email a one-time code. Used both to set a password the first time and to reset a forgotten
/// one — the two are the same operation, so they're the same endpoint.
///
/// Unauthenticated by necessity: it IS the way in. The abuse surface is guarded inside
/// requestOtp — one code per minute per address, ten-minute expiry, five wrong tries and it's
/// dead.
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "That doesn't look like an email address" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const result = await requestOtp(email);

  if (!result.ok) return Response.json({ error: result.error }, { status: 429 });

  return Response.json({ ok: true });
}
