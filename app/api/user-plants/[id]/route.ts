import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/http/json";
import { getSupabase, getUser } from "@/lib/supabase/server";
import { PlantFields } from "@/lib/green-space/schemas";

const Patch = PlantFields.extend({ photo_path: z.string().max(300).nullish() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, Patch);
  if (err) return err;
  // Photos must live in the caller's own storage folder.
  if (body.photo_path && !body.photo_path.startsWith(`${user.id}/`)) return jsonError(403, "FORBIDDEN_PATH");
  const patch = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v === "" ? null : v]));
  const { data, error } = await supabase.from("user_plants").update(patch).eq("id", id).select("id");
  if (error || !data?.length) return jsonError(404, "UPDATE_FAILED");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const { data } = await supabase.from("user_plants").delete().eq("id", id).select("photo_path");
  if (!data?.length) return jsonError(404, "NOT_FOUND");
  if (data[0].photo_path) await supabase.storage.from("plant-photos").remove([data[0].photo_path]);
  return NextResponse.json({ ok: true });
}
