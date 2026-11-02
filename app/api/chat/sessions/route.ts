import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http/json";
import { getSupabase, getUser } from "@/lib/supabase/server";

export async function GET() {
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const { data, error } = await supabase.from("chat_sessions").select("id, title, workflow, updated_at").order("updated_at", { ascending: false }).limit(30);
  if (error) return jsonError(500, "SESSIONS_READ_FAILED");
  return NextResponse.json({ sessions: data });
}
