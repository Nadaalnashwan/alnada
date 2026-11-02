/**
 * Assembles the curated catalogue from source files + generated enrichment
 * (toxicity.json, images.json, perenual.json) into:
 *   - data/generated/catalog.json   (used by the app when Supabase is not configured, and by tests)
 *   - supabase/seed/seed.sql        (idempotent seed for the Supabase database)
 *
 * Product ids are deterministic UUIDs derived from the SKU, so the same product has the same id
 * in the local catalogue, the database, carts, wishlists and chat recommendations.
 *
 * Usage: npx tsx scripts/build-catalog.ts
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SPECIES_SOURCE } from "../data/species.source";
import { ACCESSORY_PRODUCTS, GIFT_PRODUCTS, PLANT_PRODUCTS } from "../data/products.source";
import { CATEGORY_DEFS } from "../lib/plants/categories";
import type { Category, ImageInfo, PetToxicity, Product, Species } from "../lib/plants/types";

const readJson = (p: string) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {});
const toxicity: Record<string, PetToxicity> = readJson("data/generated/toxicity.json");
// Serve the locally mirrored copy (scripts/mirror-images.ts) when present; keep licence/attribution.
const rawImages: Record<string, (ImageInfo & { local_url?: string }) | null> = readJson("data/generated/images.json");
const images: Record<string, ImageInfo | null> = Object.fromEntries(
  Object.entries(rawImages).map(([k, v]) => [k, v && v.local_url ? { url: v.local_url, thumb_url: v.local_url, license: v.license, attribution: v.attribution, source_url: v.source_url } : v]),
);
const perenualRaw: Record<string, { miss?: boolean; id: number; image?: ImageInfo | null; details?: Record<string, unknown> | null; description_ar?: string | null }> = readJson("data/generated/perenual.json");
// Confirmed misses are cached by the importer only to save quota; they carry no data.
const perenual = Object.fromEntries(Object.entries(perenualRaw).filter(([, e]) => !e.miss && e.id > 0));

function uuidFromSku(sku: string) {
  const h = createHash("sha1").update(`alnada:product:${sku}`).digest("hex");
  // RFC 4122 layout with version 5 and variant bits.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const unknownTox: PetToxicity = { cats: "unknown", dogs: "unknown", source: null, source_url: null, matched_name: null, verified_at: null };

const species: Species[] = SPECIES_SOURCE.map((s) => ({
  slug: s.slug,
  scientific_name: s.scientific_name,
  family: s.family,
  name_en: s.name_en,
  name_ar: s.name_ar,
  description_en: s.description_en,
  description_ar: s.description_ar,
  light: s.light,
  water: s.water,
  humidity: s.humidity,
  temp_min_c: s.temp[0],
  temp_max_c: s.temp[1],
  placement: s.placement,
  difficulty: s.difficulty,
  size: s.size,
  habit: s.habit,
  heat_tolerant: !!s.heat_tolerant,
  flowering: !!s.flowering,
  aromatic: !!s.aromatic,
  succulent: !!s.succulent,
  tips_en: s.tips_en,
  tips_ar: s.tips_ar,
  problems_en: s.problems_en,
  problems_ar: s.problems_ar,
  perenual_id: perenual[s.slug]?.id ?? null,
  references: s.references,
  toxicity: toxicity[s.slug] ?? unknownTox,
  image: images[`species:${s.slug}`] ?? perenual[s.slug]?.image ?? null,
}));
const speciesBySlug = new Map(species.map((s) => [s.slug, s]));

const products: Product[] = [];

for (const p of PLANT_PRODUCTS) {
  const sp = speciesBySlug.get(p.species);
  if (!sp) throw new Error(`Unknown species ${p.species} for ${p.sku}`);
  products.push({
    id: uuidFromSku(p.sku), sku: p.sku, slug: p.suffix ? `${sp.slug}-${p.suffix}` : sp.slug, kind: "plant",
    species_slug: sp.slug, name_en: sp.name_en, name_ar: sp.name_ar,
    description_en: sp.description_en, description_ar: sp.description_ar,
    variant_en: p.variant_en, variant_ar: p.variant_ar, price_sar: p.price, compare_at_sar: p.compareAt ?? null,
    stock: p.stock, is_active: true, is_featured: !!p.featured, is_best_seller: !!p.best, is_new: !!p.isNew,
    image: sp.image, category_slugs: [],
  });
}
for (const g of GIFT_PRODUCTS) {
  const sp = speciesBySlug.get(g.species);
  if (!sp) throw new Error(`Unknown species ${g.species} for ${g.sku}`);
  products.push({
    id: uuidFromSku(g.sku), sku: g.sku, slug: g.slug, kind: "gift", species_slug: sp.slug,
    name_en: g.name_en, name_ar: g.name_ar, description_en: g.description_en, description_ar: g.description_ar,
    variant_en: "Gift wrapped with card", variant_ar: "مغلفة للإهداء مع بطاقة", price_sar: g.price, compare_at_sar: g.compareAt ?? null,
    stock: g.stock, is_active: true, is_featured: !!g.featured, is_best_seller: !!g.best, is_new: !!g.isNew,
    image: sp.image, category_slugs: [],
  });
}
for (const a of ACCESSORY_PRODUCTS) {
  products.push({
    id: uuidFromSku(a.sku), sku: a.sku, slug: a.slug, kind: a.kind, species_slug: null,
    name_en: a.name_en, name_ar: a.name_ar, description_en: a.description_en, description_ar: a.description_ar,
    variant_en: a.variant_en, variant_ar: a.variant_ar, price_sar: a.price, compare_at_sar: a.compareAt ?? null,
    stock: a.stock, is_active: true, is_featured: !!a.featured, is_best_seller: !!a.best, is_new: !!a.isNew,
    image: images[a.image] ?? null, category_slugs: [],
  });
}

for (const p of products) {
  const sp = p.species_slug ? speciesBySlug.get(p.species_slug)! : null;
  p.category_slugs = CATEGORY_DEFS.filter((c) => c.rule(p, sp)).map((c) => c.slug);
}

const categories: Category[] = CATEGORY_DEFS.map((c, i) => {
  const img = c.cover.startsWith("acc:") ? images[c.cover] : speciesBySlug.get(c.cover)?.image;
  return { slug: c.slug, name_en: c.name_en, name_ar: c.name_ar, description_en: c.description_en, description_ar: c.description_ar, sort: i, image_url: img?.thumb_url ?? null };
});

// Sanity checks: every category must open real products; no product without an image.
for (const c of categories) {
  const n = products.filter((p) => p.category_slugs.includes(c.slug)).length;
  if (n === 0) throw new Error(`Category ${c.slug} has no products`);
}
const missingImages = products.filter((p) => !p.image).map((p) => p.sku);
if (missingImages.length) throw new Error(`Products without images: ${missingImages.join(", ")}`);

const slugs = new Set<string>();
for (const p of products) {
  if (slugs.has(p.slug)) throw new Error(`Duplicate product slug ${p.slug}`);
  slugs.add(p.slug);
}

mkdirSync("data/generated", { recursive: true });
writeFileSync("data/generated/catalog.json", JSON.stringify({ generated_at: new Date().toISOString(), species, categories, products }, null, 1) + "\n");

// ---------- SQL seed ----------
const q = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return `array[${v.map(q).join(",")}]::text[]`;
  if (typeof v === "object") return `${q(JSON.stringify(v))}::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const row = (vals: unknown[]) => `(${vals.map(q).join(", ")})`;

const sql: string[] = [
  "-- AL NADA seed data. Generated by scripts/build-catalog.ts — do not edit by hand.",
  "-- Prices and stock are DEMO DATA. Idempotent: safe to re-run.",
  "begin;",
  "",
  "insert into public.categories (slug, name_en, name_ar, description_en, description_ar, sort, image_url) values",
  categories.map((c) => row([c.slug, c.name_en, c.name_ar, c.description_en, c.description_ar, c.sort, c.image_url])).join(",\n"),
  "on conflict (slug) do update set name_en = excluded.name_en, name_ar = excluded.name_ar, description_en = excluded.description_en,",
  "  description_ar = excluded.description_ar, sort = excluded.sort, image_url = excluded.image_url;",
  "",
  "insert into public.plant_species (slug, scientific_name, family, name_en, name_ar, description_en, description_ar, light, water, humidity,",
  "  temp_min_c, temp_max_c, placement, difficulty, size, habit, heat_tolerant, flowering, aromatic, succulent, tips_en, tips_ar,",
  "  problems_en, problems_ar, perenual_id, botanical_references, toxicity_cats, toxicity_dogs, toxicity_source, toxicity_source_url,",
  "  toxicity_matched_name, toxicity_verified_at, image, last_verified_at, perenual_data) values",
  species.map((s) => row([s.slug, s.scientific_name, s.family, s.name_en, s.name_ar, s.description_en, s.description_ar, s.light, s.water, s.humidity,
    s.temp_min_c, s.temp_max_c, s.placement, s.difficulty, s.size, s.habit, s.heat_tolerant, s.flowering, s.aromatic, s.succulent, s.tips_en, s.tips_ar,
    s.problems_en, s.problems_ar, s.perenual_id, s.references, s.toxicity.cats, s.toxicity.dogs, s.toxicity.source, s.toxicity.source_url,
    s.toxicity.matched_name, s.toxicity.verified_at, s.image, new Date().toISOString().slice(0, 10),
    perenual[s.slug]?.details ? { ...perenual[s.slug].details, description_ar: perenual[s.slug].description_ar ?? null } : null])).join(",\n"),
  "on conflict (slug) do update set scientific_name = excluded.scientific_name, family = excluded.family, name_en = excluded.name_en,",
  "  name_ar = excluded.name_ar, description_en = excluded.description_en, description_ar = excluded.description_ar, light = excluded.light,",
  "  water = excluded.water, humidity = excluded.humidity, temp_min_c = excluded.temp_min_c, temp_max_c = excluded.temp_max_c,",
  "  placement = excluded.placement, difficulty = excluded.difficulty, size = excluded.size, habit = excluded.habit,",
  "  heat_tolerant = excluded.heat_tolerant, flowering = excluded.flowering, aromatic = excluded.aromatic, succulent = excluded.succulent,",
  "  tips_en = excluded.tips_en, tips_ar = excluded.tips_ar, problems_en = excluded.problems_en, problems_ar = excluded.problems_ar,",
  "  perenual_id = coalesce(excluded.perenual_id, plant_species.perenual_id), botanical_references = excluded.botanical_references,",
  "  toxicity_cats = excluded.toxicity_cats, toxicity_dogs = excluded.toxicity_dogs, toxicity_source = excluded.toxicity_source,",
  "  toxicity_source_url = excluded.toxicity_source_url, toxicity_matched_name = excluded.toxicity_matched_name,",
  "  toxicity_verified_at = excluded.toxicity_verified_at, image = excluded.image, last_verified_at = excluded.last_verified_at,",
  "  perenual_data = coalesce(excluded.perenual_data, plant_species.perenual_data);",
  "",
  "insert into public.products (id, sku, slug, kind, species_id, name_en, name_ar, description_en, description_ar, variant_en, variant_ar,",
  "  price_sar, compare_at_sar, stock, is_active, is_featured, is_best_seller, is_new, image) values",
  products.map((p) => `(${q(p.id)}, ${q(p.sku)}, ${q(p.slug)}, ${q(p.kind)}, ${p.species_slug ? `(select id from public.plant_species where slug = ${q(p.species_slug)})` : "null"}, ` +
    [p.name_en, p.name_ar, p.description_en, p.description_ar, p.variant_en, p.variant_ar, p.price_sar, p.compare_at_sar, p.stock, p.is_active,
      p.is_featured, p.is_best_seller, p.is_new, p.image].map(q).join(", ") + ")").join(",\n"),
  "on conflict (id) do update set sku = excluded.sku, slug = excluded.slug, kind = excluded.kind, species_id = excluded.species_id,",
  "  name_en = excluded.name_en, name_ar = excluded.name_ar, description_en = excluded.description_en, description_ar = excluded.description_ar,",
  "  variant_en = excluded.variant_en, variant_ar = excluded.variant_ar, image = excluded.image;",
  "  -- price, stock and flags are intentionally NOT overwritten so admin edits survive re-seeding.",
  "",
  "delete from public.product_categories where product_id in (" + products.map((p) => q(p.id)).join(", ") + ");",
  "insert into public.product_categories (product_id, category_id) values",
  products.flatMap((p) => p.category_slugs.map((c) => `(${q(p.id)}, (select id from public.categories where slug = ${q(c)}))`)).join(",\n") + ";",
  "",
  "commit;",
  "",
];
mkdirSync("supabase/seed", { recursive: true });
writeFileSync("supabase/seed/seed.sql", sql.join("\n"));

const plants = products.filter((p) => p.kind === "plant").length;
console.log(`species=${species.length} products=${products.length} (plants=${plants}, gifts=${GIFT_PRODUCTS.length}, accessories=${ACCESSORY_PRODUCTS.length}) categories=${categories.length}`);
for (const c of categories) console.log(`  ${c.slug.padEnd(18)} ${products.filter((p) => p.category_slugs.includes(c.slug)).length}`);
