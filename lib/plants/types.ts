// Shared domain types for botanical species (biology) and store products (commerce).
// Biology and commerce are deliberately separate: one species can back many products.

export type LightLevel = "low" | "medium" | "bright_indirect" | "full_sun";
export type WaterNeed = "low" | "moderate" | "high";
export type Humidity = "low" | "moderate" | "high";
export type Placement = "indoor" | "outdoor";
export type Difficulty = "easy" | "moderate" | "hard";
export type PlantSize = "small" | "medium" | "large";
export type GrowthHabit = "upright" | "climbing" | "trailing" | "rosette" | "bushy" | "tree";

/** ASPCA-based status. "unknown" is never treated as safe. */
export type ToxicityStatus = "toxic" | "non_toxic" | "unknown";

export interface PetToxicity {
  cats: ToxicityStatus;
  dogs: ToxicityStatus;
  source: string | null;
  source_url: string | null;
  matched_name: string | null;
  verified_at: string | null;
}

export interface ImageInfo {
  url: string;
  thumb_url: string;
  license: string | null;
  attribution: string | null;
  source_url: string | null;
}

export interface Species {
  slug: string;
  scientific_name: string;
  family: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  light: LightLevel[];
  water: WaterNeed;
  humidity: Humidity;
  temp_min_c: number;
  temp_max_c: number;
  placement: Placement[];
  difficulty: Difficulty;
  size: PlantSize;
  habit: GrowthHabit;
  heat_tolerant: boolean;
  flowering: boolean;
  aromatic: boolean;
  succulent: boolean;
  tips_en: string[];
  tips_ar: string[];
  problems_en: string[];
  problems_ar: string[];
  perenual_id: number | null;
  references: string[];
  toxicity: PetToxicity;
  image: ImageInfo | null;
}

export type ProductKind = "plant" | "pot" | "soil" | "accessory" | "gift";

export interface Category {
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  sort: number;
  image_url: string | null;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  kind: ProductKind;
  species_slug: string | null;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  variant_en: string;
  variant_ar: string;
  price_sar: number;
  compare_at_sar: number | null;
  stock: number;
  is_active: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new: boolean;
  image: ImageInfo | null;
  category_slugs: string[];
}

/** Product joined with its species for display and recommendations. */
export interface ProductWithSpecies extends Product {
  species: Species | null;
}
