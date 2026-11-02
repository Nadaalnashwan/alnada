import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/http/json";
import { getSupabase, getUser } from "@/lib/supabase/server";

const Body = z.object({
  items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(50),
  contact: z.object({ name: z.string().trim().min(1).max(120), city: z.string().trim().min(1).max(80) }),
});

export async function POST(req: Request) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, Body);
  if (err) return err;
  // Prices, stock checks and totals are enforced inside the database function.
  const { data, error } = await supabase.rpc("place_demo_order", { p_items: body.items, p_contact: body.contact });
  if (error) {
    const code = error.message.match(/(PRODUCT_UNAVAILABLE|INVALID_QUANTITY|INSUFFICIENT_STOCK|EMPTY_ORDER|TOO_MANY_ITEMS)(:[0-9a-f-]+)?/)?.[0] ?? "CHECKOUT_FAILED";
    return jsonError(409, code);
  }
  revalidateTag("catalog"); // stock changed
  return NextResponse.json({ order: data });
}
