/**
 * Perenual → AL NADA botanical cache import.
 *
 *   Perenual API → retrieve species → validate (Zod) → normalise → (optional) translate with Llama
 *   → data/generated/perenual.json → `npm run data:build` → supabase/seed/seed.sql
 *
 * Only the species AL NADA sells are fetched (no bulk copy of Perenual). Results are cached, so
 * re-running skips species already imported; the free plan's daily quota is respected and the
 * script stops cleanly on HTTP 429. Curated care data in data/species.source.ts remains the source
 * of truth for the storefront; Perenual fields are stored alongside for cross-checking.
 *
 * Usage: npm run data:perenual [-- --translate] [-- --limit 10]
 */
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { SPECIES_SOURCE } from "../data/species.source";
import { llamaConfig } from "../lib/ai/provider";

config({ path: ".env.local" });
const KEY = process.env.PERENUAL_API_KEY;
const OUT = "data/generated/perenual.json";
const args = process.argv.slice(2);
const translate = args.includes("--translate");
const limit = Number(args[args.indexOf("--limit") + 1]) || Infinity;

const Image = z.object({
  license: z.number().nullish(), license_name: z.string().nullish(), license_url: z.string().nullish(),
  original_url: z.string().nullish(), regular_url: z.string().nullish(), medium_url: z.string().nullish(), thumbnail: z.string().nullish(),
}).nullish();
const ListItem = z.object({ id: z.number(), common_name: z.string().nullish(), scientific_name: z.array(z.string()).default([]), default_image: Image });
const Details = z.object({
  id: z.number(), common_name: z.string().nullish(), scientific_name: z.array(z.string()).default([]), family: z.string().nullish(),
  description: z.string().nullish(), watering: z.string().nullish(), sunlight: z.array(z.string()).nullish(), care_level: z.string().nullish(),
  indoor: z.boolean().nullish(), drought_tolerant: z.boolean().nullish(), poisonous_to_pets: z.union([z.boolean(), z.number()]).nullish(),
  default_image: Image,
}).passthrough();

type Entry = {
  id: number; matched: string; fetched_at: string;
  details: Partial<z.infer<typeof Details>> | null;
  description_ar?: string | null;
  image?: { url: string; thumb_url: string; license: string | null; attribution: string | null; source_url: string | null } | null;
};

class QuotaError extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const normSci = (s: string) => s.toLowerCase().replace(/['"‘’]/g, "").replace(/\s+/g, " ").trim();

async function get(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://perenual.com/api/v2/${path}`);
  url.search = new URLSearchParams({ key: KEY!, ...params }).toString();
  const res = await fetch(url);
  if (res.status === 429) throw new QuotaError("Perenual daily quota reached (HTTP 429)");
  if (!res.ok) throw new Error(`Perenual ${path} HTTP ${res.status}`);
  return res.json();
}

async function translateToArabic(text: string): Promise<string | null> {
  const cfg = llamaConfig();
  if (!cfg.ready) return null;
  const res = await fetch(cfg.chatUrl, {
    method: "POST", headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model, temperature: 0.2, max_tokens: 600,
      messages: [
        { role: "system", content: "Translate the plant description into natural Modern Standard Arabic for a plant store. Keep scientific (Latin) names unchanged. Output only the translation." },
        { role: "user", content: text.slice(0, 2500) },
      ],
    }),
  });
  if (!res.ok) return null;
  return (await res.json())?.choices?.[0]?.message?.content?.trim() ?? null;
}

async function main() {
  if (!KEY) {
    console.error("PERENUAL_API_KEY is not set in .env.local");
    process.exit(2);
  }
  const cache: Record<string, Entry> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  let calls = 0;
  let done = 0;
  try {
    for (const sp of SPECIES_SOURCE) {
      if (done >= limit) break;
      if (cache[sp.slug]?.details) continue;
      // 1) search by scientific name (genus + species); require an exact scientific-name match
      const query = sp.scientific_name.replace(/ hybrids?$/i, "");
      const list = await get("species-list", { q: query });
      calls++;
      const items = z.array(ListItem).parse(list.data ?? []);
      const target = normSci(query);
      const hit = items.find((i) => i.scientific_name.some((n) => normSci(n) === target)) ?? items.find((i) => i.scientific_name.some((n) => normSci(n).startsWith(target)));
      if (!hit) {
        console.log(`MISS  ${sp.scientific_name} (no exact scientific-name match among ${items.length})`);
        continue;
      }
      // 2) details (free plans may restrict some ids → keep list data only)
      let details: Entry["details"] = null;
      try {
        details = Details.parse(await get(`species/details/${hit.id}`));
        calls++;
      } catch (e) {
        if (e instanceof QuotaError) throw e;
        console.log(`      details unavailable for ${hit.id}: ${(e as Error).message}`);
      }
      const img = (details?.default_image ?? hit.default_image) || null;
      const imgUrl = img?.regular_url ?? img?.medium_url ?? img?.original_url;
      const entry: Entry = {
        id: hit.id, matched: hit.scientific_name[0], fetched_at: new Date().toISOString(),
        details: details ? { id: details.id, common_name: details.common_name, family: details.family, description: details.description, watering: details.watering, sunlight: details.sunlight, care_level: details.care_level, indoor: details.indoor, drought_tolerant: details.drought_tolerant, poisonous_to_pets: details.poisonous_to_pets } : null,
        // Only keep images whose licence Perenual reports (e.g. CC BY-SA); upgraded/paywalled images have none.
        image: imgUrl && img?.license_name && !/upgrade/i.test(imgUrl) ? { url: imgUrl, thumb_url: img.thumbnail ?? imgUrl, license: img.license_name, attribution: "Perenual", source_url: img.license_url ?? null } : null,
      };
      if (translate && details?.description) entry.description_ar = await translateToArabic(details.description);
      cache[sp.slug] = entry;
      done++;
      console.log(`OK    ${sp.scientific_name} → Perenual #${hit.id} (${entry.details ? "details" : "list only"}${entry.description_ar ? ", translated" : ""})`);
      await sleep(600);
    }
  } catch (e) {
    if (e instanceof QuotaError) console.warn(`\n${e.message}. Progress saved; re-run tomorrow to continue.`);
    else throw e;
  } finally {
    mkdirSync("data/generated", { recursive: true });
    writeFileSync(OUT, JSON.stringify(cache, null, 2) + "\n");
    console.log(`\nAPI calls: ${calls}. Cached species: ${Object.keys(cache).length}/${SPECIES_SOURCE.length}. Wrote ${OUT}. Next: npm run data:build`);
  }
}

main().catch((e) => {
  console.error("Perenual import FAILED:", (e as Error).message);
  process.exit(1);
});
