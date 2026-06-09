import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "lantern_auth";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Let the login page + its endpoint through (everything else is gated).
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }
  const token = req.cookies.get(COOKIE)?.value;
  if (token && token === process.env.LANTERN_PASSWORD) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

// Run on everything except Next internals + static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
