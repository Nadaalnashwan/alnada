import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http/json";
import { getSupabase, getUser } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return jsonError(400, "INVALID_ID");
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const { data: session } = await supabase.from("chat_sessions").select("id, context").eq("id", id).maybeSingle();
  if (!session) return jsonError(404, "NOT_FOUND"); // RLS hides other users' sessions
  const { data: messages } = await supabase.from("chat_messages").select("role, content, payload, created_at").eq("session_id", id).order("created_at").limit(200);
  return NextResponse.json({ session, messages: messages ?? [] });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const { error } = await supabase.from("chat_sessions").delete().eq("id", id);
  if (error) return jsonError(400, "DELETE_FAILED");
  return NextResponse.json({ ok: true });
}
