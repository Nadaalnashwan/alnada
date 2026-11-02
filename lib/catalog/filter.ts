// Pure catalogue filtering/sorting, shared by the shop page, category pages and Nada AI.
import type { LightLevel, ProductKind, ProductWithSpecies } from "@/lib/plants/types";

export interface CatalogFilter {
  q?: string;
  category?: string;
  kind?: ProductKind | "plants";
  light?: LightLevel;
  petSafe?: boolean;
  maxPrice?: number;
  sort?: "featured" | "price_asc" | "price_desc" | "name";
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[ً-ٰٟ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();

export function matchesQuery(p: ProductWithSpecies, q: string) {
  const needle = norm(q);
  if (!needle) return true;
  const hay = norm([p.name_ar, p.name_en, p.species?.scientific_name, p.species?.name_ar, p.species?.name_en, p.species?.family, p.sku].filter(Boolean).join(" "));
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

export function filterProducts(all: ProductWithSpecies[], f: CatalogFilter) {
  let list = all.filter((p) => p.is_active);
  if (f.q) list = list.filter((p) => matchesQuery(p, f.q!));
  if (f.category) list = list.filter((p) => p.category_slugs.includes(f.category!));
  if (f.kind === "plants") list = list.filter((p) => p.kind === "plant" || p.kind === "gift");
  else if (f.kind) list = list.filter((p) => p.kind === f.kind);
  if (f.light) list = list.filter((p) => p.species?.light.includes(f.light!));
  if (f.petSafe) list = list.filter((p) => p.species?.toxicity.cats === "non_toxic" && p.species?.toxicity.dogs === "non_toxic");
  if (f.maxPrice) list = list.filter((p) => p.price_sar <= f.maxPrice!);
  const sorted = [...list];
  switch (f.sort) {
    case "price_asc": sorted.sort((a, b) => a.price_sar - b.price_sar); break;
    case "price_desc": sorted.sort((a, b) => b.price_sar - a.price_sar); break;
    case "name": sorted.sort((a, b) => a.name_en.localeCompare(b.name_en)); break;
    default: sorted.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || Number(b.is_best_seller) - Number(a.is_best_seller) || a.sku.localeCompare(b.sku));
  }
  return sorted;
}
