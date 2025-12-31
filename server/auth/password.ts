import crypto from "crypto";

const HASH_ITERATIONS = 120000;
const HASH_LENGTH = 64;
const HASH_DIGEST = "sha512";

export function createSalt() {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPassword(password: string, salt: string) {
  return crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_LENGTH, HASH_DIGEST)
    .toString("hex");
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actualHash = hashPassword(password, salt);
  try {
    const actual = Buffer.from(actualHash, "hex");
    const expected = Buffer.from(expectedHash, "hex");
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch (err) {
    return false;
  }
}
