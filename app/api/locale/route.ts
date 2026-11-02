import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { locale } = await req.json().catch(() => ({ locale: "ar" }));
  const res = NextResponse.json({ ok: true });
  res.cookies.set("locale", locale === "en" ? "en" : "ar", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
