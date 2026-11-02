import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** Request-scoped client acting as the signed-in user (RLS applies). Null when not configured. */
export async function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // called from a Server Component: middleware refreshes the session instead
        }
      },
    },
  });
}

export type SessionUser = { id: string; email: string | null; isAdmin: boolean; fullName: string | null };

/** The verified current user (via auth.getUser, not the unverified cookie payload). */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, email: data.user.email ?? null, isAdmin: profile?.role === "admin", fullName: profile?.full_name ?? null };
});
