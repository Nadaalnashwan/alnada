/**
 * Verifies the configured Meta Llama provider without printing secrets:
 *  1. lists Meta Llama text-generation models from the provider's live catalogue
 *  2. checks LLAMA_MODEL is among them
 *  3. runs one real Arabic chat completion and prints the reply + latency
 *
 * Usage: npm run verify:llama
 */
import { config } from "dotenv";
import { llamaConfig } from "../lib/ai/provider";

config({ path: ".env.local" });
const cfg = llamaConfig();

async function listModels(): Promise<string[]> {
  if (cfg.provider === "groq") {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${cfg.token}` } });
    if (!r.ok) throw new Error(`Groq model list HTTP ${r.status}`);
    return (await r.json()).data.map((m: { id: string }) => m.id).filter((id: string) => /llama/i.test(id));
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${(cfg as { account: string }).account}/ai/models/search?search=llama&per_page=100`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${cfg.token}` } });
  const body = await r.json();
  if (!r.ok || !body.success) throw new Error(`Cloudflare model catalogue HTTP ${r.status}: ${JSON.stringify(body.errors ?? []).slice(0, 300)}`);
  return body.result
    .filter((m: { name: string; task?: { name?: string } }) => m.name.startsWith("@cf/meta/") && /text generation/i.test(m.task?.name ?? ""))
    .map((m: { name: string }) => m.name);
}

async function main() {
  console.log(`provider=${cfg.provider} model=${cfg.model} configured=${cfg.ready}`);
  if (!cfg.ready) {
    console.error(cfg.provider === "cloudflare" ? "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env.local" : "Set GROQ_API_KEY in .env.local");
    process.exit(2);
  }
  const models = await listModels();
  console.log(`Meta Llama text-generation models available (${models.length}):`);
  for (const m of models) console.log(`  ${m === cfg.model ? "*" : " "} ${m}`);
  if (!models.includes(cfg.model)) console.warn(`WARNING: LLAMA_MODEL "${cfg.model}" was not found in the catalogue.`);

  const started = Date.now();
  const r = await fetch(cfg.chatUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 200,
      temperature: 0.3,
      messages: [
        { role: "system", content: "أنتِ ندى، مساعدة نباتية في متجر سعودي. ردي باللهجة السعودية باختصار." },
        { role: "user", content: "عندي مونستيرا في غرفتي وإضاءتها متوسطة، كيف أحافظ عليها؟" },
      ],
    }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`Chat completion HTTP ${r.status}: ${JSON.stringify(body).slice(0, 400)}`);
  console.log(`\nArabic completion OK in ${Date.now() - started} ms (model reported: ${body.model ?? cfg.model}):\n`);
  console.log(body.choices?.[0]?.message?.content);
}

main().catch((e) => {
  console.error("Llama verification FAILED:", (e as Error).message);
  process.exit(1);
});
