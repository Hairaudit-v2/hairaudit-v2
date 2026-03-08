import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const betaBlockedRoutes = [
    "/login/doctor",
    "/login/clinic",
    "/dashboard/doctor",
    "/dashboard/clinic",
  ];
  if (betaBlockedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return new NextResponse("403 access disabled during beta", { status: 403 });
  }

  // ✅ Allow Playwright report rendering (NO AUTH)
  if (pathname.match(/^\/reports\/[^/]+\/html$/)) {
    return NextResponse.next();
  }

  // ✅ Allow public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // ❗ Everything else can stay protected
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
