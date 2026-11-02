// Deterministic plant recommendation engine.
// 1) Hard constraints exclude unsuitable or unsafe products (never overridden by scores).
// 2) Remaining candidates are ranked with configurable weights.
// Scores express preference fit, NOT a scientifically validated survival probability.

import { z } from "zod";
import type { LightLevel, ProductWithSpecies, Species } from "@/lib/plants/types";

export const PreferencesSchema = z.object({
  placement: z.enum(["indoor", "outdoor", "balcony"]).optional(),
  light: z.enum(["low", "medium", "bright_indirect", "full_sun"]).optional(),
  afternoon_sun: z.boolean().optional(),
  city: z.string().max(60).optional(),
  pets: z.array(z.enum(["cat", "dog"])).max(2).optional(),
  budget_max_sar: z.number().positive().max(100000).optional(),
  maintenance: z.enum(["low", "any"]).optional(),
  travels_often: z.boolean().optional(),
  experience: z.enum(["beginner", "intermediate", "expert"]).optional(),
  size: z.enum(["small", "medium", "large"]).optional(),
  wants_flowers: z.boolean().optional(),
  wants_fragrance: z.boolean().optional(),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_WEIGHTS = {
  lightPrimary: 2,
  lowMaintenance: 3,
  experienceFit: 2,
  sizeMatch: 2,
  flowers: 2,
  fragrance: 2,
  heatTolerance: 2,
  bestSeller: 0.5,
};
export type Weights = typeof DEFAULT_WEIGHTS;

export type ExclusionReason = "pets" | "budget" | "placement" | "light" | "heat" | "stock";

export interface Recommendation {
  product: ProductWithSpecies;
  score: number;
  reasons_ar: string[];
  reasons_en: string[];
  cautions_ar: string[];
  cautions_en: string[];
}

export interface RecommendationResult {
  results: Recommendation[];
  candidates: number;
  excluded: Record<ExclusionReason, number>;
}

// Lowland Saudi cities with extreme summer heat; highland cities (Abha, Taif, Al Baha) are milder.
const HOT_CITIES = ["riyadh", "الرياض", "jeddah", "جدة", "dammam", "الدمام", "khobar", "الخبر", "makkah", "mecca", "مكة", "madinah", "medina", "المدينة",
  "qassim", "القصيم", "buraidah", "بريدة", "hail", "حائل", "tabuk", "تبوك", "jazan", "جازان", "najran", "نجران", "ahsa", "الأحساء", "hofuf", "الهفوف", "jubail", "الجبيل", "yanbu", "ينبع"];

export function isHotClimate(city?: string) {
  if (!city) return false;
  const c = city.toLowerCase();
  return HOT_CITIES.some((h) => c.includes(h));
}

function lightOk(s: Species, light?: LightLevel) {
  return !light || s.light.includes(light);
}

/** A pet requirement is satisfied only by a verified non-toxic listing; "unknown" is excluded. */
export function petSafe(s: Species, pets: Preferences["pets"]) {
  if (!pets?.length) return true;
  return pets.every((p) => (p === "cat" ? s.toxicity.cats : s.toxicity.dogs) === "non_toxic");
}

export function harshOutdoorExposure(prefs: Preferences) {
  const outdoor = prefs.placement === "outdoor" || prefs.placement === "balcony";
  return outdoor && (prefs.afternoon_sun || prefs.light === "full_sun") && (isHotClimate(prefs.city) || !prefs.city);
}

export function recommend(
  products: ProductWithSpecies[],
  prefs: Preferences,
  opts: { limit?: number; weights?: Weights; excludeProductIds?: string[]; sort?: "score" | "price_asc" } = {},
): RecommendationResult {
  const { limit = 3, weights = DEFAULT_WEIGHTS, excludeProductIds = [], sort = "score" } = opts;
  const excluded: Record<ExclusionReason, number> = { pets: 0, budget: 0, placement: 0, light: 0, heat: 0, stock: 0 };
  const harsh = harshOutdoorExposure(prefs);
  const ranked: Recommendation[] = [];

  const plants = products.filter((p) => p.kind === "plant" && p.species && !excludeProductIds.includes(p.id));

  for (const product of plants) {
    const s = product.species!;
    // ── hard constraints (order matters only for the exclusion statistics) ──
    if (!product.is_active || product.stock < 1) { excluded.stock++; continue; }
    if (!petSafe(s, prefs.pets)) { excluded.pets++; continue; }
    if (prefs.placement === "indoor" && !s.placement.includes("indoor")) { excluded.placement++; continue; }
    if ((prefs.placement === "outdoor" || prefs.placement === "balcony") && !s.placement.includes("outdoor")) { excluded.placement++; continue; }
    if (!lightOk(s, prefs.light)) { excluded.light++; continue; }
    if (harsh && !s.heat_tolerant) { excluded.heat++; continue; }
    if (prefs.budget_max_sar !== undefined && product.price_sar > prefs.budget_max_sar) { excluded.budget++; continue; }

    // ── soft scoring ──
    let score = 0;
    const ar: string[] = [];
    const en: string[] = [];
    const cautionAr: string[] = [];
    const cautionEn: string[] = [];

    if (prefs.light) {
      ar.push(lightReasonAr(prefs.light));
      en.push(lightReasonEn(prefs.light));
      if (s.light[0] === prefs.light) score += weights.lightPrimary;
    }
    if (prefs.pets?.length) {
      const both = prefs.pets.length === 2;
      ar.push(`مصنفة غير سامة ${both ? "للقطط والكلاب" : prefs.pets[0] === "cat" ? "للقطط" : "للكلاب"} في قائمة ASPCA`);
      en.push(`Listed as non-toxic to ${both ? "cats and dogs" : prefs.pets[0] === "cat" ? "cats" : "dogs"} by the ASPCA`);
    }
    const wantsLow = prefs.maintenance === "low" || prefs.travels_often;
    if (wantsLow) {
      if (s.water === "low") {
        score += weights.lowMaintenance;
        ar.push(prefs.travels_often ? "تتحمل العطش، مناسبة لو تسافر كثير" : "تحتاج ري قليل");
        en.push(prefs.travels_often ? "Drought tolerant — fine while you travel" : "Needs little watering");
      } else if (s.water === "high") {
        score -= weights.lowMaintenance;
        cautionAr.push("تحتاج ري منتظم");
        cautionEn.push("Needs regular watering");
      }
    }
    const level = prefs.experience ?? (wantsLow ? "beginner" : undefined);
    if (level) {
      const fit = level === "beginner" ? { easy: 1, moderate: -0.5, hard: -1.5 } : level === "intermediate" ? { easy: 0.5, moderate: 0.5, hard: -0.5 } : { easy: 0, moderate: 0.5, hard: 0.5 };
      score += weights.experienceFit * fit[s.difficulty];
      if (s.difficulty === "easy" && level === "beginner") { ar.push("سهلة العناية للمبتدئين"); en.push("Easy care for beginners"); }
      if (s.difficulty === "hard") { cautionAr.push("تحتاج خبرة وعناية دقيقة"); cautionEn.push("Needs experience and careful care"); }
    }
    if (prefs.size) {
      if (s.size === prefs.size) { score += weights.sizeMatch; ar.push(sizeAr[s.size]); en.push(sizeEn[s.size]); }
      else score -= weights.sizeMatch / 2;
    }
    if (prefs.wants_flowers && s.flowering) { score += weights.flowers; ar.push("نبتة مزهرة"); en.push("Flowering plant"); }
    if (prefs.wants_fragrance && s.aromatic) { score += weights.fragrance; ar.push("عطرية"); en.push("Fragrant"); }
    if (harsh && s.heat_tolerant) {
      score += weights.heatTolerance;
      ar.push("تتحمل حرارة وشمس العصر في السعودية");
      en.push("Tolerates Saudi heat and afternoon sun");
    }
    if (product.is_best_seller) score += weights.bestSeller;
    if (prefs.pets?.length === 0 || !prefs.pets) {
      if (s.toxicity.cats === "toxic" || s.toxicity.dogs === "toxic") {
        cautionAr.push("سامة للحيوانات الأليفة حسب ASPCA");
        cautionEn.push("Toxic to pets per the ASPCA");
      }
    }

    ranked.push({ product, score: Math.round(score * 100) / 100, reasons_ar: ar, reasons_en: en, cautions_ar: cautionAr, cautions_en: cautionEn });
  }

  // one product per species (keep the better-scoring, then cheaper, variant)
  const bySpecies = new Map<string, Recommendation>();
  for (const r of ranked) {
    const key = r.product.species!.slug;
    const prev = bySpecies.get(key);
    if (!prev || r.score > prev.score || (r.score === prev.score && r.product.price_sar < prev.product.price_sar)) bySpecies.set(key, r);
  }
  const unique = [...bySpecies.values()].sort((a, b) =>
    sort === "price_asc" ? a.product.price_sar - b.product.price_sar || b.score - a.score : b.score - a.score || a.product.price_sar - b.product.price_sar || a.product.sku.localeCompare(b.product.sku),
  );

  return { results: unique.slice(0, limit), candidates: unique.length, excluded };
}

const lightReasonAr = (l: LightLevel) => ({ low: "تتحمل الإضاءة الضعيفة", medium: "تناسب الإضاءة المتوسطة", bright_indirect: "تحب الإضاءة القوية غير المباشرة", full_sun: "تحب الشمس المباشرة" })[l];
const lightReasonEn = (l: LightLevel) => ({ low: "Tolerates low light", medium: "Suits medium light", bright_indirect: "Likes bright indirect light", full_sun: "Loves direct sun" })[l];
const sizeAr = { small: "حجم صغير", medium: "حجم متوسط", large: "حجم كبير" } as const;
const sizeEn = { small: "Small size", medium: "Medium size", large: "Large size" } as const;
