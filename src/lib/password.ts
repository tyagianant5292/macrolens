import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/// scrypt from node:crypto, not bcrypt from npm.
///
/// It's a memory-hard KDF designed for exactly this, it's in the standard library, and it means
/// the thing guarding every account isn't a transitive dependency someone can take over. N=2^16
/// is the current sensible default — slow enough to make offline cracking expensive, fast enough
/// that signing in doesn't feel broken.
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  // salt:hash — the salt is public by design; it exists to stop one rainbow table cracking
  // every account at once.
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const derived = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);

  // timingSafeEqual, not ===. String comparison bails at the first differing byte, and the time
  // it takes leaks how much of the hash you got right.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/// Deliberately minimal. Length is what actually resists guessing; forcing a symbol and a digit
/// mostly produces "Password1!" and a sticky note.
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters";
  if (password.length > 200) return "That's too long";
  return null;
}
