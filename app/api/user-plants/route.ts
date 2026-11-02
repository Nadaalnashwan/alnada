import { NextResponse } from "next/server";
import { z } from "zod";
import { getSpeciesIdMap } from "@/lib/catalog/repo";
import { jsonError, parseBody } from "@/lib/http/json";
import { PlantFields } from "@/lib/green-space/schemas";
import { getSupabase, getUser } from "@/lib/supabase/server";


const Create = PlantFields.extend({
  speciesSlug: z.string().max(80).nullish(),
  unconfirmedLabel: z.string().trim().min(2).max(120).nullish(),
}).refine((b) => b.speciesSlug || b.unconfirmedLabel, { message: "species or label required" });

export async function POST(req: Request) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, Create);
  if (err) return err;
  const speciesId = body.speciesSlug ? (await getSpeciesIdMap()).get(body.speciesSlug) : null;
  if (body.speciesSlug && !speciesId) return jsonError(404, "SPECIES_NOT_FOUND");
  const { data, error } = await supabase.from("user_plants").insert({
    user_id: user.id, source: "manual", species_id: speciesId ?? null,
    identification_status: speciesId ? "confirmed" : "unconfirmed", unconfirmed_label: speciesId ? null : body.unconfirmedLabel,
    nickname: body.nickname || null, location: body.location || null, light_condition: body.light_condition ?? null,
    watering_preference: body.watering_preference || null, notes: body.notes || null, acquired_at: body.acquired_at || null,
  }).select("id").single();
  if (error) return jsonError(400, "CREATE_FAILED");
  // An owned plant is no longer just "explored".
  if (speciesId) await supabase.from("explored_plants").delete().eq("user_id", user.id).eq("species_id", speciesId);
  return NextResponse.json({ id: data.id });
}
