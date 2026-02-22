import { NextResponse } from "next/server";
import { fail } from "@/src/lib/http/response";
import { readRefreshCookie, rotateRefreshToken } from "@/src/lib/auth/session";

export async function POST() {
  try {
    const refreshToken = await readRefreshCookie();
    if (!refreshToken) {
      return fail(401, { code: "NO_REFRESH_TOKEN", message: "Refresh token missing" });
    }

    const response = NextResponse.json({ success: true, data: { rotated: true } });
    await rotateRefreshToken(refreshToken, response);
    return response;
  } catch {
    return fail(401, { code: "INVALID_REFRESH_TOKEN", message: "Unable to refresh session" });
  }
}
