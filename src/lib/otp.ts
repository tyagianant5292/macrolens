import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { otpEmail, sendMail } from "./mail";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // one code per minute per address
const MAX_ATTEMPTS = 5;

/// SHA-256, not scrypt. The code is six digits and lives ten minutes — the entire keyspace is a
/// million, so a slow KDF buys nothing that the attempt counter doesn't already buy. What this
/// does buy: a stolen database dump contains no working codes.
const hash = (code: string) => createHash("sha256").update(code).digest();

const equal = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/// randomInt, not Math.random. Math.random is not a CSPRNG — its output is predictable from
/// prior outputs, which for a login code means guessable.
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export type OtpResult = { ok: true } | { ok: false; error: string };

/// Email a fresh code, replacing any previous one for this address.
export async function requestOtp(email: string): Promise<OtpResult> {
  const existing = await prisma.emailOtp.findUnique({ where: { email } });

  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - existing.createdAt.getTime())) / 1000,
    );
    return { ok: false, error: `Wait ${wait}s before asking for another code` };
  }

  const code = newCode();
  const row = {
    codeHash: hash(code).toString("hex"),
    expires: new Date(Date.now() + TTL_MS),
    attempts: 0,
    createdAt: new Date(),
  };

  await prisma.emailOtp.upsert({
    where: { email },
    create: { email, ...row },
    update: row,
  });

  const { subject, html, text } = otpEmail(code, Math.round(TTL_MS / 60000));
  await sendMail({ to: email, subject, html, text });

  return { ok: true };
}

/// Check a code and consume it. Consuming on success is what makes it one-time; leaving it
/// behind would turn a six-digit code into a standing password.
export async function consumeOtp(email: string, code: string): Promise<OtpResult> {
  const row = await prisma.emailOtp.findUnique({ where: { email } });

  // Same message for "no code", "expired" and "wrong" — telling them which one it was tells an
  // attacker whether the address has a pending code.
  const invalid = { ok: false, error: "That code isn't right, or it's expired" } as const;
  if (!row) return invalid;

  if (row.expires.getTime() < Date.now()) {
    await prisma.emailOtp.delete({ where: { email } });
    return invalid;
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.emailOtp.delete({ where: { email } });
    return { ok: false, error: "Too many wrong tries. Ask for a new code." };
  }

  if (!equal(hash(code), Buffer.from(row.codeHash, "hex"))) {
    await prisma.emailOtp.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    return invalid;
  }

  await prisma.emailOtp.delete({ where: { email } });
  return { ok: true };
}
