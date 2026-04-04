import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/src/lib/http/response";
import { readRefreshCookie, rotateRefreshToken } from "@/src/lib/auth/session";
import { authErrorResponse } from "@/src/lib/auth/error-response";

export async function POST(req: NextRequest) {
  try {
    let refreshToken = await readRefreshCookie();

    if (!refreshToken) {
      const body = await req.json().catch(() => null);
      refreshToken = body?.refreshToken ?? null;
    }

    if (!refreshToken) {
      return fail(401, { code: "NO_REFRESH_TOKEN", message: "Refresh token missing" });
    }

    const tempResponse = NextResponse.json({});
    const { accessToken, refreshToken: newRefreshToken } = await rotateRefreshToken(refreshToken, tempResponse);

    const response = NextResponse.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });

    tempResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });

    return response;
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }
    console.error("[app/api/auth/refresh/route.ts]", error);
    return fail(401, { code: "INVALID_REFRESH_TOKEN", message: "Unable to refresh session" });
  }
}
