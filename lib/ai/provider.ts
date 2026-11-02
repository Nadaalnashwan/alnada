// Provider configuration (no server-only import so scripts can reuse it). Secrets stay server-side.

export type LlamaProvider = "cloudflare" | "groq";

export function llamaConfig(env: NodeJS.ProcessEnv = process.env) {
  const provider: LlamaProvider = env.LLAMA_PROVIDER === "groq" ? "groq" : "cloudflare";
  if (provider === "groq") {
    const token = env.GROQ_API_KEY ?? "";
    return {
      provider, token, model: env.LLAMA_MODEL || "llama-3.3-70b-versatile",
      chatUrl: "https://api.groq.com/openai/v1/chat/completions", ready: Boolean(token),
    };
  }
  const account = env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const token = env.CLOUDFLARE_API_TOKEN ?? "";
  return {
    provider, token, account, model: env.LLAMA_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    chatUrl: `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`,
    ready: Boolean(account && token),
  };
}

export const isLlamaConfigured = () => llamaConfig().ready;
