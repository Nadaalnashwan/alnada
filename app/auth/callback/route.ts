import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

// Handles email-confirmation and password-recovery links (PKCE code exchange).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/my-green-space";
  const supabase = await getSupabase();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safe, url.origin));
  }
  return NextResponse.redirect(new URL("/account/login?error=link", url.origin));
}
