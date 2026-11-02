import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import type { Category, ImageInfo, ProductWithSpecies, Species } from "@/lib/plants/types";
import { LOCAL_CATEGORIES, LOCAL_PRODUCTS, LOCAL_SPECIES } from "./local";

// Public catalogue reads use an anonymous, cookie-less client so results can be cached across users.
// When Supabase is not configured yet the curated local catalogue (same content as the seed) is used.

// Untyped PostgREST rows; mapped into strict domain types immediately below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>;

export function mapSpecies(r: DbRow): Species {
  return {
    slug: r.slug, scientific_name: r.scientific_name, family: r.family, name_en: r.name_en, name_ar: r.name_ar,
    description_en: r.description_en, description_ar: r.description_ar, light: r.light, water: r.water, humidity: r.humidity,
    temp_min_c: r.temp_min_c, temp_max_c: r.temp_max_c, placement: r.placement, difficulty: r.difficulty, size: r.size, habit: r.habit,
    heat_tolerant: r.heat_tolerant, flowering: r.flowering, aromatic: r.aromatic, succulent: r.succulent,
    tips_en: r.tips_en, tips_ar: r.tips_ar, problems_en: r.problems_en, problems_ar: r.problems_ar, perenual_id: r.perenual_id,
    references: r.botanical_references ?? [],
    toxicity: { cats: r.toxicity_cats, dogs: r.toxicity_dogs, source: r.toxicity_source, source_url: r.toxicity_source_url, matched_name: r.toxicity_matched_name, verified_at: r.toxicity_verified_at },
    image: r.image as ImageInfo | null,
  };
}

const PRODUCT_SELECT = "*, species:plant_species(*), product_categories(categories(slug))";

export function mapProduct(r: DbRow): ProductWithSpecies {
  return {
    id: r.id, sku: r.sku, slug: r.slug, kind: r.kind, species_slug: r.species?.slug ?? null, name_en: r.name_en, name_ar: r.name_ar,
    description_en: r.description_en, description_ar: r.description_ar, variant_en: r.variant_en, variant_ar: r.variant_ar,
    price_sar: Number(r.price_sar), compare_at_sar: r.compare_at_sar === null ? null : Number(r.compare_at_sar), stock: r.stock,
    is_active: r.is_active, is_featured: r.is_featured, is_best_seller: r.is_best_seller, is_new: r.is_new, image: r.image,
    category_slugs: (r.product_categories ?? []).map((pc: DbRow) => pc.categories?.slug).filter(Boolean),
    species: r.species ? mapSpecies(r.species) : null,
  };
}

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

export const getAllProducts = unstable_cache(
  async (): Promise<ProductWithSpecies[]> => {
    if (!isSupabaseConfigured()) return LOCAL_PRODUCTS;
    const { data, error } = await anonClient().from("products").select(PRODUCT_SELECT).eq("is_active", true).order("sku");
    if (error) throw new Error(`Catalogue query failed: ${error.message}`);
    return (data ?? []).map(mapProduct);
  },
  ["catalog-products"],
  { revalidate: 60, tags: ["catalog"] },
);

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    if (!isSupabaseConfigured()) return LOCAL_CATEGORIES;
    const { data, error } = await anonClient().from("categories").select("*").order("sort");
    if (error) throw new Error(`Category query failed: ${error.message}`);
    return (data ?? []) as Category[];
  },
  ["catalog-categories"],
  { revalidate: 300, tags: ["catalog"] },
);

export const getAllSpecies = unstable_cache(
  async (): Promise<Species[]> => {
    if (!isSupabaseConfigured()) return LOCAL_SPECIES;
    const { data, error } = await anonClient().from("plant_species").select("*").order("name_en");
    if (error) throw new Error(`Species query failed: ${error.message}`);
    return (data ?? []).map(mapSpecies);
  },
  ["catalog-species"],
  { revalidate: 300, tags: ["catalog"] },
);

export async function getProductBySlug(slug: string) {
  return (await getAllProducts()).find((p) => p.slug === slug) ?? null;
}

export async function getProductsByIds(ids: string[]) {
  const all = await getAllProducts();
  return ids.map((id) => all.find((p) => p.id === id)).filter((p): p is ProductWithSpecies => !!p);
}

export async function getSpeciesBySlug(slug: string) {
  return (await getAllSpecies()).find((s) => s.slug === slug) ?? null;
}

/** Database uuid of a species (needed for user-owned records). */
export async function getSpeciesIdMap(): Promise<Map<string, string>> {
  if (!isSupabaseConfigured()) return new Map();
  const { data } = await anonClient().from("plant_species").select("id, slug");
  return new Map((data ?? []).map((r) => [r.slug as string, r.id as string]));
}
