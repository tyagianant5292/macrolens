import type { NextRequest } from "next/server";
import { z } from "zod";
import { consumeOtp } from "@/lib/otp";
import { hashPassword, passwordProblem } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
  password: z.string(),
});

/// Verify a code and set a password in one step.
///
/// Deliberately one step, not two. If verifying the code handed back a "you may now set a
/// password" token, that token would be a second credential — and any second credential is a
/// second thing to get wrong. The code is consumed here or not at all.
///
/// This is also the sign-up path: an email nobody has used before gets an account. There is no
/// separate registration, because there's nothing to register — proving the address IS the
/// account.
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Enter the 6-digit code and a password" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { code, password } = parsed.data;

  const weak = passwordProblem(password);
  if (weak) return Response.json({ error: weak }, { status: 400 });

  const otp = await consumeOtp(email, code);
  if (!otp.ok) return Response.json({ error: otp.error }, { status: 400 });

  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, emailVerified: new Date() },
    update: {
      passwordHash,
      emailVerified: new Date(),
      // Every existing token was minted against the old version, so this signs out every other
      // device. That is the point: if you're here because someone else got in, changing the
      // password has to actually push them out.
      tokenVersion: { increment: 1 },
    },
  });

  return Response.json({ ok: true });
}
