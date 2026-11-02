import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/http/json";
import { getSupabase, getUser } from "@/lib/supabase/server";

const Body = z.object({ productId: z.string().uuid() });

export async function GET() {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const { data, error } = await supabase.from("wishlists").select("product_id").order("created_at", { ascending: false });
  if (error) return jsonError(500, "WISHLIST_READ_FAILED");
  return NextResponse.json({ ids: data.map((r) => r.product_id) });
}

export async function POST(req: Request) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, Body);
  if (err) return err;
  const { error } = await supabase.from("wishlists").upsert({ user_id: user.id, product_id: body.productId }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
  if (error) return jsonError(400, "WISHLIST_WRITE_FAILED");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, Body);
  if (err) return err;
  const { error } = await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", body.productId);
  if (error) return jsonError(400, "WISHLIST_WRITE_FAILED");
  return NextResponse.json({ ok: true });
}
