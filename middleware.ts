import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function sanitizeNextPathEdge(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed === "" || trimmed.startsWith("//") || trimmed.includes(":")) {
    return null;
  }
  return trimmed;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Repair auth return URLs that land on the marketing/homepage root with `?code=...`.
  // When this happens, we must redirect immediately to the dedicated code-exchange handler.
  if (pathname === "/") {
    const url = request.nextUrl;
    const code = url.searchParams.get("code");
    if (typeof code === "string" && code.trim() !== "") {
      const nextParam = sanitizeNextPathEdge(url.searchParams.get("next"));
      const signupRole = url.searchParams.get("signup_role");

      const redirectUrl = request.url;
      const target = new URL(redirectUrl);
      target.pathname = "/auth/callback";
      target.searchParams.set("code", code);
      if (nextParam) target.searchParams.set("next", nextParam);
      if (signupRole) target.searchParams.set("signup_role", signupRole);
      return NextResponse.redirect(target);
    }
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
  // Explicitly include `/` so homepage root requests (including `/?code=...`)
  // always pass through middleware.
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
