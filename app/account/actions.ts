"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabase, getUser } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await getSupabase();
  await supabase?.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

const Profile = z.object({ full_name: z.string().trim().max(120), city: z.string().trim().max(80), preferred_locale: z.enum(["ar", "en"]) });

export async function updateProfile(_: unknown, form: FormData) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return { ok: false };
  const parsed = Profile.safeParse({ full_name: form.get("full_name") ?? "", city: form.get("city") ?? "", preferred_locale: form.get("preferred_locale") ?? "ar" });
  if (!parsed.success) return { ok: false };
  // Only these columns are updatable by customers (role is protected by column privileges).
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  revalidatePath("/account");
  return { ok: !error };
}
