import bcrypt from "bcryptjs";

const defaultSaltRounds = process.env.NODE_ENV === "test" ? 4 : 10;
const configuredSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? defaultSaltRounds);
const saltRounds =
  Number.isFinite(configuredSaltRounds) && configuredSaltRounds > 0
    ? Math.floor(configuredSaltRounds)
    : defaultSaltRounds;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
