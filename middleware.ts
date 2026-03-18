import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth/session";

const protectedRoutes = {
  SUPER_ADMIN: ["/admin"],
  ORGANIZER: ["/organizer"],
  ATTENDEE: ["/account"],
  SCANNER: ["/scanner"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await getSession();
  
  // If no session, redirect to login for any protected route
  if (!session) {
    for (const role of Object.values(protectedRoutes)) {
      if (role.some(prefix => pathname.startsWith(prefix))) {
        const url = req.nextUrl.clone();
        url.pathname = "/auth/login";
        url.searchParams.set("redirect", pathname);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // Session exists, check role access
  const userRole = session.user.role;
  const allowedPrefixes = protectedRoutes[userRole as keyof typeof protectedRoutes] || [];
  
  const isAllowed = allowedPrefixes.some(prefix => pathname.startsWith(prefix));

  if (!isAllowed) {
    // If trying to access a protected route for another role, redirect to their home
    for (const [role, prefixes] of Object.entries(protectedRoutes)) {
      if (role !== userRole && prefixes.some(prefix => pathname.startsWith(prefix))) {
        const homeUrl = new URL(allowedPrefixes[0] || "/", req.url);
        return NextResponse.redirect(homeUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
