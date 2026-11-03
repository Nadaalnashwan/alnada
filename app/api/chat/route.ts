import { NextResponse } from "next/server";
import { LlamaError, LLAMA_MODEL, isLlamaConfigured, llamaChat } from "@/lib/ai/llama";
import { runNada } from "@/lib/ai/nada";
import { ChatRequestSchema } from "@/lib/ai/schemas";
import { supabaseNadaData } from "@/lib/ai/supabase-data";
import { getAllProducts, getAllSpecies, getSpeciesIdMap } from "@/lib/catalog/repo";
import { jsonError, parseBody } from "@/lib/http/json";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isLlamaConfigured()) return jsonError(503, "AI_NOT_CONFIGURED");
  const [body, err] = await parseBody(req, ChatRequestSchema);
  if (err) return err;

  const [supabase, user] = [await getSupabase(), await getUser()];
  const limit = rateLimit(clientKey(req, user?.id), user ? 30 : 15, 5 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "RATE_LIMITED", retryAfter: limit.retryAfter }, { status: 429 });

  const [products, species, speciesIds] = await Promise.all([getAllProducts(), getAllSpecies(), getSpeciesIdMap()]);
  const data = supabase && user ? supabaseNadaData(supabase, user.id, speciesIds) : null;

  // Authenticated sessions: load server-side context (never trust another user's session id).
  let sessionId: string | null = null;
  let context = body.context ?? null;
  if (supabase && user && body.sessionId) {
    const { data: s } = await supabase.from("chat_sessions").select("id, context").eq("id", body.sessionId).maybeSingle();
    if (s) { sessionId = s.id; context = { ...(s.context ?? {}), ...(body.context?.save_explored === undefined ? {} : { save_explored: body.context.save_explored }) }; }
  }

  try {
    const result = await runNada(
      { message: body.message, history: body.history, context, workflow: body.workflow, userPlantId: body.userPlantId, sessionId },
      {
        llm: llamaChat, model: LLAMA_MODEL, products, species, user: user ? { id: user.id } : null, data,
        logRecommendation: supabase
          ? async (criteria, productIds) => { await supabase.from("recommendation_logs").insert({ user_id: user?.id ?? null, criteria, product_ids: productIds, result_count: productIds.length }); }
          : undefined,
      },
    );

    if (supabase && user) {
      if (!sessionId) {
        const { data: s } = await supabase.from("chat_sessions")
          .insert({ user_id: user.id, title: body.message.slice(0, 80), workflow: result.context.workflow, context: result.context })
          .select("id").single();
        sessionId = s?.id ?? null;
      } else {
        await supabase.from("chat_sessions").update({ context: result.context, workflow: result.context.workflow }).eq("id", sessionId);
      }
      if (sessionId) {
        await supabase.from("chat_messages").insert([
          { session_id: sessionId, user_id: user.id, role: "user", content: body.message },
          { session_id: sessionId, user_id: user.id, role: "assistant", content: result.reply.slice(0, 8000), payload: { blocks: result.blocks, intent: result.intent } },
        ]);
      }
    }
    return NextResponse.json({ ...result, sessionId });
  } catch (e) {
    if (e instanceof LlamaError) {
      const status = e.code === "RATE_LIMITED" || e.code === "QUOTA_EXHAUSTED" ? 429 : e.code === "NOT_CONFIGURED" ? 503 : 502;
      return jsonError(status, `AI_${e.code}`);
    }
    console.error("chat route failed", (e as Error).message);
    return jsonError(500, "CHAT_FAILED");
  }
}
