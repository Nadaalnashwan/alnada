// Deterministic insights about a customer's saved plant, derived ONLY from saved data
// (species requirements + the customer's own records). Shared by Nada AI and the plant page so
// both always say the same thing. Never claims to know the plant's real-time condition.

import { dayCount } from "@/lib/i18n/format";
import type { LightLevel, Species } from "@/lib/plants/types";

/** Typical days between waterings for a species' water need — a prompt to check the soil, not a schedule. */
export const CHECK_INTERVAL_DAYS = { low: 14, moderate: 7, high: 4 } as const;

export interface CareRecord { activity: string; occurred_at: string; notes: string | null }

export interface PlantInsights {
  days_since_watering: number | null;
  typical_check_interval_days: number | null;
  soil_check_due: boolean;
  no_watering_recorded: boolean;
  light_matches: boolean | null;
  recent_observations: { date: string; note: string }[];
  leaves_cleaned_recorded: boolean;
  suggestions_ar: string[];
  suggestions_en: string[];
  helpful_product_slugs: string[];
}

export function plantInsights(
  species: Species | null,
  plant: { light_condition: string | null },
  logs: CareRecord[],
  now: Date = new Date(),
): PlantInsights {
  const sorted = [...logs].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const lastWater = sorted.find((l) => l.activity === "watering");
  const days = lastWater ? Math.max(0, Math.floor((now.getTime() - new Date(lastWater.occurred_at).getTime()) / 86_400_000)) : null;
  const interval = species ? CHECK_INTERVAL_DAYS[species.water] : null;
  const due = days !== null && interval !== null && days >= interval;
  const lightMatches = species && plant.light_condition ? species.light.includes(plant.light_condition as LightLevel) : null;
  const observations = sorted.filter((l) => l.activity === "observation" && l.notes).slice(0, 3).map((l) => ({ date: l.occurred_at.slice(0, 10), note: l.notes! }));
  const cleaned = sorted.some((l) => l.activity === "cleaning");

  const ar: string[] = [];
  const en: string[] = [];
  const products: string[] = [];
  if (species) {
    if (days === null) { ar.push("سجّل آخر ري عشان نقدر نتابع معك"); en.push("Log the last watering so we can follow along"); }
    else if (due) { ar.push(`مر ${dayCount(days, "ar")} على آخر ري مسجل — افحص رطوبة التربة قبل الري`); en.push(`${dayCount(days, "en")} since the last recorded watering — check soil moisture before watering`); }
    if (lightMatches === false) { ar.push("الإضاءة المسجلة ما تطابق احتياجها؛ فكّر تغيّر مكانها"); en.push("The recorded light doesn't match its needs; consider moving it"); }
    if (species.humidity === "high") {
      ar.push("تحب الرطوبة العالية: أبعدها عن هواء المكيف المباشر"); en.push("Likes high humidity: keep it out of direct AC airflow");
      products.push("ultrasonic-humidifier");
    }
    if (!cleaned) { ar.push("امسح الغبار عن الأوراق"); en.push("Wipe dust off the leaves"); }
    if (observations.length) products.push(species.succulent ? "cactus-succulent-mix-5l" : "indoor-potting-mix-5l");
  }
  return {
    days_since_watering: days,
    typical_check_interval_days: interval,
    soil_check_due: due,
    no_watering_recorded: days === null,
    light_matches: lightMatches,
    recent_observations: observations,
    leaves_cleaned_recorded: cleaned,
    suggestions_ar: ar,
    suggestions_en: en,
    helpful_product_slugs: [...new Set(products)],
  };
}
