/**
 * Resolves one species-correct, openly licensed photo per species (and per accessory) from
 * Wikimedia Commons, via the lead image of the species' Wikipedia article, and records the
 * licence + author attribution. Output: data/generated/images.json
 *
 * Images are hot-linked from upload.wikimedia.org (allowed by Commons with attribution).
 * Perenual images can later replace these via scripts/import-perenual.ts.
 *
 * Usage: npx tsx scripts/fetch-images.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SPECIES_SOURCE } from "../data/species.source";
import { ACCESSORY_ARTICLES, IMAGE_OVERRIDES } from "../data/image-sources";

const UA = { "User-Agent": "ALNADA-catalog/1.0 (educational project; https://github.com/Nadaalnashwan/alnada)" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** GET JSON with retries: Wikimedia answers 429/HTML when rate limited. */
async function getJson(url: string | URL, tries = 4): Promise<any | null> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 404) return null;
    if (res.ok) {
      try {
        return await res.json();
      } catch {
        /* rate-limit HTML page — fall through to backoff */
      }
    }
    await sleep(1500 * (i + 1));
  }
  return null;
}

/** Fallback: first photo on Commons whose title mentions the scientific name. */
async function commonsSearch(query: string) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query", format: "json", list: "search", srnamespace: "6", srlimit: "10",
    srsearch: `intitle:"${query}" filetype:bitmap`, origin: "*",
  }).toString();
  const json = await getJson(url);
  const hit = (json?.query?.search ?? []).find((r: { title: string }) => /\.jpe?g$/i.test(r.title));
  return hit ? (hit.title as string) : null;
}

async function commonsInfo(fileTitle: string) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query", format: "json", prop: "imageinfo", titles: fileTitle,
    iiprop: "url|extmetadata", iiurlwidth: "900", origin: "*",
  }).toString();
  const json = await getJson(url);
  if (!json?.query?.pages) return null;
  const page = Object.values(json.query.pages)[0] as { imageinfo?: Array<Record<string, any>> };
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const clean = (u: string) => u.split("?")[0];
  const imageUrl = clean(info.thumburl ?? info.url);
  return {
    url: imageUrl,
    thumb_url: imageUrl.replace(/\/\d+px-/, "/500px-"),
    license: meta.LicenseShortName?.value ?? null,
    attribution: meta.Artist ? stripHtml(meta.Artist.value) : null,
    source_url: info.descriptionurl ?? null,
  };
}

async function leadImageFile(article: string) {
  const json = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${article}`);
  const src: string | undefined = json?.originalimage?.source;
  if (!src) return null;
  return "File:" + decodeURIComponent(src.split("?")[0].split("/").pop()!);
}

async function main() {
  const force = process.argv.includes("--force");
  const path = "data/generated/images.json";
  const out: Record<string, unknown> = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const jobs: Array<[string, string, string]> = [
    ...SPECIES_SOURCE.map((sp) => [`species:${sp.slug}`, sp.wiki, sp.scientific_name] as [string, string, string]),
    ...Object.entries(ACCESSORY_ARTICLES).map(([k, a]) => [k, a, a.replace(/_/g, " ")] as [string, string, string]),
  ];
  for (const key of Object.keys(out)) if (!jobs.some(([k]) => k === key)) delete out[key];
  for (const [key, article, searchName] of jobs) {
    const override = IMAGE_OVERRIDES[key];
    const cached = out[key] as { source_url?: string } | null | undefined;
    const overrideApplied = override && cached?.source_url?.endsWith(encodeURI(override.replace(/ /g, "_")));
    if (cached && !force && (!override || overrideApplied)) continue;
    let file: string | null = override ?? (await leadImageFile(article));
    let info = file ? await commonsInfo(file) : null;
    if (!info) {
      // Lead image may be a local (non-Commons) file; fall back to a Commons photo of the species.
      file = await commonsSearch(searchName);
      info = file ? await commonsInfo(file) : null;
    }
    out[key] = info;
    console.log(`${info ? "OK  " : "MISS"} ${key} ${info?.license ?? ""}`);
    await sleep(400); // stay well inside Wikimedia rate limits
  }
  mkdirSync("data/generated", { recursive: true });
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.log("Wrote data/generated/images.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
