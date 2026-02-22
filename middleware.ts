import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/src/lib/auth/constants";

function decodeRole(token: string): string | null {
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/organizer") || pathname.startsWith("/admin")) {
    const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    const role = decodeRole(token);
    if (pathname.startsWith("/admin") && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/organizer/status", req.url));
    }
    if (pathname.startsWith("/organizer") && role !== "ORGANIZER") {
      return NextResponse.redirect(new URL("/admin/organizers", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/:path*", "/organizer/:path*", "/admin/:path*"],
};
