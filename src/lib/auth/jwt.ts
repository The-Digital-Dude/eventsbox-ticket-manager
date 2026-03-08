import jwt from "jsonwebtoken";
import { env } from "@/src/lib/env";
import { ACCESS_EXPIRES_SECONDS, REFRESH_EXPIRES_SECONDS } from "@/src/lib/auth/constants";

export type AccessTokenPayload = {
  sub: string;
  role: "SUPER_ADMIN" | "ORGANIZER" | "ATTENDEE";
  email: string;
};

export type RefreshTokenPayload = {
  sub: string;
  kind: "refresh";
  nonce: string;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_SECONDS });
}

export function signRefreshToken(payload: RefreshTokenPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_SECONDS });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
