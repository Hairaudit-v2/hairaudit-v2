import { NextResponse } from "next/server";
import { USER_ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  if (!role || !USER_ROLES.includes(role as any)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const res = NextResponse.redirect(new URL(`/dashboard/${role}`, req.url));
  res.cookies.set("dev_role", role, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return res;
}
