import { NextResponse } from "next/server";
import { z } from "zod";
import { CARE_ACTIVITIES } from "@/lib/ai/schemas";
import { jsonError, parseBody } from "@/lib/http/json";
import { getSupabase, getUser } from "@/lib/supabase/server";

const Body = z.object({
  plantId: z.string().uuid(),
  activity: z.enum(CARE_ACTIVITIES),
  notes: z.string().trim().max(1000).nullish(),
  occurredAt: z.string().datetime({ offset: true }).nullish(),
});

export async function POST(req: Request) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, Body);
  if (err) return err;
  const when = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (when.getTime() > Date.now() + 5 * 60_000) return jsonError(400, "FUTURE_DATE");
  // RLS also verifies that the plant belongs to this user.
  const { data, error } = await supabase.from("care_logs")
    .insert({ user_id: user.id, user_plant_id: body.plantId, activity: body.activity, notes: body.notes || null, occurred_at: when.toISOString() })
    .select("id, activity, occurred_at, notes").single();
  if (error) return jsonError(403, "CARE_LOG_FAILED");
  return NextResponse.json({ log: data });
}

export async function DELETE(req: Request) {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const [body, err] = await parseBody(req, z.object({ id: z.string().uuid() }));
  if (err) return err;
  const { error } = await supabase.from("care_logs").delete().eq("id", body.id);
  if (error) return jsonError(400, "DELETE_FAILED");
  return NextResponse.json({ ok: true });
}
