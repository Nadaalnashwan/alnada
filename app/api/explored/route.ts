import { NextResponse } from "next/server";
import { z } from "zod";
import { getSpeciesIdMap } from "@/lib/catalog/repo";
import { jsonError, parseBody } from "@/lib/http/json";
import { getSupabase, getUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, z.object({ speciesSlug: z.string().max(80), productId: z.string().uuid().nullish(), source: z.enum(["product_view", "manual"]).default("product_view") }));
  if (err) return err;
  const speciesId = (await getSpeciesIdMap()).get(body.speciesSlug);
  if (!speciesId) return jsonError(404, "SPECIES_NOT_FOUND");
  const { error } = await supabase.from("explored_plants").upsert(
    { user_id: user.id, species_id: speciesId, product_id: body.productId ?? null, source: body.source, reason: body.source === "product_view" ? "Saved from product page" : null, last_explored_at: new Date().toISOString() },
    { onConflict: "user_id,species_id" },
  );
  if (error) return jsonError(400, "EXPLORED_WRITE_FAILED");
  return NextResponse.json({ ok: true });
}

/** Remove one explored plant ({ id }) or clear the whole history ({ all: true }). */
export async function DELETE(req: Request) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, z.union([z.object({ id: z.string().uuid() }), z.object({ all: z.literal(true) })]));
  if (err) return err;
  const q = supabase.from("explored_plants").delete().eq("user_id", user.id);
  const { error } = "id" in body ? await q.eq("id", body.id) : await q;
  if (error) return jsonError(400, "DELETE_FAILED");
  return NextResponse.json({ ok: true });
}
