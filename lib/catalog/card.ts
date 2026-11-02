import type { Locale } from "@/lib/i18n/dict";
import type { ProductWithSpecies } from "@/lib/plants/types";

/** Minimal, serialisable product shape for client cards (keeps payloads small). */
export interface CardProduct {
  id: string;
  slug: string;
  kind: string;
  name: string;
  subtitle: string;
  variant: string;
  price: number;
  compareAt: number | null;
  stock: number;
  image: string | null;
  isNew: boolean;
  isBest: boolean;
  petSafe: boolean;
  speciesSlug: string | null;
  /** Care-at-a-glance for plants (null for accessories). */
  care: { light: string; water: "low" | "moderate" | "high"; difficulty: "easy" | "moderate" | "hard" } | null;
}

export function toCard(p: ProductWithSpecies, locale: Locale): CardProduct {
  return {
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    name: locale === "ar" ? p.name_ar : p.name_en,
    subtitle: p.species?.scientific_name ?? (locale === "ar" ? p.name_en : p.name_ar),
    variant: locale === "ar" ? p.variant_ar : p.variant_en,
    price: p.price_sar,
    compareAt: p.compare_at_sar,
    stock: p.stock,
    image: p.image?.thumb_url ?? p.image?.url ?? null,
    isNew: p.is_new,
    isBest: p.is_best_seller,
    petSafe: !!p.species && p.species.toxicity.cats === "non_toxic" && p.species.toxicity.dogs === "non_toxic",
    speciesSlug: p.species?.slug ?? null,
    care: p.species ? { light: p.species.light[0], water: p.species.water, difficulty: p.species.difficulty } : null,
  };
}
