"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getSupabase, getUser } from "@/lib/supabase/server";

const ALLOWED_IMAGE_HOSTS = ["upload.wikimedia.org", "thumb.wikimedia.org", "perenual.com"];

const Update = z.object({
  id: z.string().uuid(),
  price_sar: z.coerce.number().min(0).max(100000),
  stock: z.coerce.number().int().min(0).max(100000),
  is_active: z.coerce.boolean(),
  image_url: z.string().url().max(500).optional().or(z.literal("")),
});

/** Admin-only product update. Checked here AND by the products RLS policy (is_admin()). */
export async function updateProduct(_: unknown, form: FormData) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user?.isAdmin) return { ok: false, error: "FORBIDDEN" };
  const parsed = Update.safeParse({ id: form.get("id"), price_sar: form.get("price_sar"), stock: form.get("stock"), is_active: form.get("is_active") === "on", image_url: form.get("image_url") ?? "" });
  if (!parsed.success) return { ok: false, error: "INVALID" };
  const { id, image_url, ...fields } = parsed.data;
  const patch: Record<string, unknown> = { ...fields };
  if (image_url) {
    const host = new URL(image_url).hostname;
    if (!ALLOWED_IMAGE_HOSTS.includes(host) && !host.endsWith(".supabase.co")) return { ok: false, error: "IMAGE_HOST" };
    patch.image = { url: image_url, thumb_url: image_url, license: null, attribution: null, source_url: null };
  }
  const { data, error } = await supabase.from("products").update(patch).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "UPDATE_FAILED" };
  revalidateTag("catalog");
  revalidatePath("/admin");
  return { ok: true };
}
