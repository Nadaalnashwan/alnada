/**
 * Mirrors every licensed catalogue photo (Wikimedia Commons) into public/images/catalog as an
 * optimised WebP, so the storefront never depends on hot-linking (Wikimedia rate-limits / times
 * out bursts of image requests). Licence + author attribution stay in data/generated/images.json.
 *
 * Writes `local_url` into images.json; build-catalog.ts then serves the local copy.
 * Idempotent: existing files are skipped. Polite: sequential with delays + retries.
 *
 * Usage: npm run data:mirror
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const UA = { "User-Agent": "ALNADA-catalog/1.0 (educational project; https://github.com/Nadaalnashwan/alnada)" };
const OUT_DIR = "public/images/catalog";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Original upload URLs can be several MB; request Commons' standard 960px thumbnail instead. */
function sizedUrl(url: string) {
  if (url.includes("/thumb/")) return url;
  const m = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/);
  return m ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/960px-${m[3]}` : url;
}

async function download(url: string): Promise<Buffer> {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 404 && url !== url.replace(/\/thumb\/(.+)\/[^/]+$/, "/$1")) {
      url = url.replace(/\/thumb\/([0-9a-f]\/[0-9a-f]{2}\/[^/]+)\/[^/]+$/, "/$1"); // fall back to original
      continue;
    }
    await sleep(3000 * (i + 1)); // 429 / transient
  }
  throw new Error(`download failed: ${url}`);
}

async function main() {
  const path = "data/generated/images.json";
  const images: Record<string, ({ url: string; local_url?: string } & Record<string, unknown>) | null> = JSON.parse(readFileSync(path, "utf8"));
  mkdirSync(OUT_DIR, { recursive: true });
  let done = 0;
  let failed = 0;
  for (const [key, info] of Object.entries(images)) {
    if (!info) continue;
    const file = `${key.replace(/[^a-z0-9]+/gi, "-")}.webp`;
    const dest = `${OUT_DIR}/${file}`;
    if (!existsSync(dest)) {
      try {
        const buf = await download(sizedUrl(info.url));
        await sharp(buf).rotate().resize({ width: 1200, height: 1500, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(dest);
        await sleep(900);
      } catch (e) {
        failed++;
        console.log(`FAIL ${key}: ${(e as Error).message}`);
        continue;
      }
    }
    info.local_url = `/images/catalog/${file}`;
    done++;
  }
  writeFileSync(path, JSON.stringify(images, null, 2) + "\n");
  console.log(`mirrored ${done}, failed ${failed}. Next: npm run data:build`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
