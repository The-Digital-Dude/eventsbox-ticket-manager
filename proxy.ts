import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "eventsbox_access";

const protectedRoutes: Record<string, string[]> = {
  SUPER_ADMIN: ["/admin"],
  ORGANIZER: ["/organizer"],
  ATTENDEE: ["/account"],
  SCANNER: ["/scanner"],
};

function getSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET not set");
  return new TextEncoder().encode(secret);
}

async function getRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = Object.values(protectedRoutes).some((prefixes) =>
    prefixes.some((p) => pathname.startsWith(p))
  );

  if (!isProtected) return NextResponse.next();

  const role = await getRole(req);

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const allowed = protectedRoutes[role] ?? [];
  const hasAccess = allowed.some((p) => pathname.startsWith(p));

  if (!hasAccess) {
    const home = allowed[0] ?? "/";
    return NextResponse.redirect(new URL(home, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)"],
};
