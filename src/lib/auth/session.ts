import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { ACCESS_EXPIRES_SECONDS, ACCESS_TOKEN_COOKIE, REFRESH_EXPIRES_SECONDS, REFRESH_TOKEN_COOKIE } from "@/src/lib/auth/constants";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/src/lib/auth/jwt";

type SessionUser = {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ORGANIZER";
};

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function issueSession(user: SessionUser, response: NextResponse) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, kind: "refresh", nonce: crypto.randomUUID() });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000),
    },
  });

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_EXPIRES_SECONDS,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_EXPIRES_SECONDS,
  });

  return { accessToken };
}

export async function rotateRefreshToken(rawRefreshToken: string, response: NextResponse) {
  const payload = verifyRefreshToken(rawRefreshToken);
  const existing = await prisma.refreshToken.findFirst({
    where: {
      userId: payload.sub,
      tokenHash: hashToken(rawRefreshToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!existing) {
    throw new Error("Invalid refresh token");
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new Error("User not found");
  }

  return issueSession(
    { id: user.id, email: user.email, role: user.role },
    response,
  );
}

export async function destroySession(response: NextResponse, userId?: string) {
  if (userId) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function readRefreshCookie() {
  const store = await cookies();
  return store.get(REFRESH_TOKEN_COOKIE)?.value;
}

export function accessTokenFromRequest(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (bearer) return bearer;
  return req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
}
