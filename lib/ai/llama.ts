import "server-only";
import { llamaConfig } from "./provider";

// Meta Llama chat completions through an OpenAI-compatible endpoint.
// Primary provider: Cloudflare Workers AI. Alternative: Groq. Selected by LLAMA_PROVIDER.
// The model id comes from LLAMA_MODEL and must be verified with `npm run verify:llama`.

export { isLlamaConfigured } from "./provider";
export const LLAMA_MODEL = llamaConfig().model;

export class LlamaError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "TIMEOUT" | "RATE_LIMITED" | "UPSTREAM" | "BAD_OUTPUT", message: string) {
    super(message);
  }
}

export interface LlamaMessage { role: "system" | "user" | "assistant"; content: string }
export interface LlamaOptions { json?: boolean; temperature?: number; maxTokens?: number; timeoutMs?: number }
export type LlamaChat = (messages: LlamaMessage[], opts?: LlamaOptions) => Promise<string>;

export const llamaChat: LlamaChat = async (messages, { json = false, temperature = 0.3, maxTokens = 900, timeoutMs = 30_000 } = {}) => {
  const cfg = llamaConfig();
  if (!cfg.ready) throw new LlamaError("NOT_CONFIGURED", `Llama provider "${cfg.provider}" is not configured`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(cfg.chatUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        // Groq supports JSON mode on the compat endpoint; for Cloudflare the prompt demands JSON and
        // the caller extracts/validates it with Zod.
        ...(json && cfg.provider === "groq" ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 429) throw new LlamaError("RATE_LIMITED", "Llama provider rate limit");
    if (!res.ok) throw new LlamaError("UPSTREAM", `Llama provider HTTP ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new LlamaError("BAD_OUTPUT", "Empty completion");
    return content;
  } catch (e) {
    if (e instanceof LlamaError) throw e;
    if ((e as Error).name === "AbortError") throw new LlamaError("TIMEOUT", "Llama request timed out");
    throw new LlamaError("UPSTREAM", (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
};
