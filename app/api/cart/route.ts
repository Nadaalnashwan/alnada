import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/http/json";
import { getSupabase, getUser } from "@/lib/supabase/server";

const Lines = z.object({ lines: z.array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(20) })).max(50) });

async function ensureCart(supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>, userId: string) {
  const { data } = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await supabase.from("carts").insert({ user_id: userId }).select("id").single();
  if (error) throw error;
  return created.id as string;
}

export async function GET() {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const { data, error } = await supabase.from("carts").select("cart_items(product_id, quantity)").eq("user_id", user.id).maybeSingle();
  if (error) return jsonError(500, "CART_READ_FAILED");
  const lines = (data?.cart_items ?? []).map((i: { product_id: string; quantity: number }) => ({ productId: i.product_id, qty: i.quantity }));
  return NextResponse.json({ lines });
}

/** Replaces the saved cart with the client's lines (validated; unknown products are rejected by FK). */
export async function PUT(req: Request) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, Lines);
  if (err) return err;
  try {
    const cartId = await ensureCart(supabase, user.id);
    await supabase.from("cart_items").delete().eq("cart_id", cartId);
    if (body.lines.length) {
      const { error } = await supabase.from("cart_items").insert(body.lines.map((l) => ({ cart_id: cartId, product_id: l.productId, quantity: l.qty })));
      if (error) return jsonError(400, "CART_WRITE_FAILED");
    }
    await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError(500, "CART_WRITE_FAILED");
  }
}
