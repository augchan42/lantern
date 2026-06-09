export const runtime = "nodejs";
import { NextResponse } from "next/server";

const COOKIE = "lantern_auth";

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };
  if (!password || password !== process.env.LANTERN_PASSWORD) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, password, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
