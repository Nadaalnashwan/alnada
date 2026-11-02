import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http/json";
import { getSupabase, getUser } from "@/lib/supabase/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supabase, user] = [await getSupabase(), await getUser()];
  if (!supabase || !user) return jsonError(401, "AUTH_REQUIRED");
  const { data, error } = await supabase.rpc("add_order_plants_to_space", { p_order_id: id });
  if (error) return jsonError(error.message.includes("ORDER_NOT_FOUND") ? 404 : 400, "ADD_FAILED");
  return NextResponse.json({ added: data as number });
}
