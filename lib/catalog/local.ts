// The generated, curated catalogue (identical content to supabase/seed/seed.sql).
// Used as the data source when Supabase is not configured, and by tests.
import catalog from "@/data/generated/catalog.json";
import type { Category, Product, ProductWithSpecies, Species } from "@/lib/plants/types";

export const LOCAL_SPECIES = catalog.species as unknown as Species[];
export const LOCAL_CATEGORIES = catalog.categories as unknown as Category[];
const speciesBySlug = new Map(LOCAL_SPECIES.map((s) => [s.slug, s]));

export const LOCAL_PRODUCTS: ProductWithSpecies[] = (catalog.products as unknown as Product[]).map((p) => ({
  ...p,
  species: p.species_slug ? speciesBySlug.get(p.species_slug) ?? null : null,
}));
