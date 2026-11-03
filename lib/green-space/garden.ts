import type { GardenPlant, GardenStatus } from "@/components/my-green-space/Garden";
import type { Dict } from "@/lib/i18n/dict";
import type { ProductWithSpecies } from "@/lib/plants/types";
import type { OwnedPlant } from "./data";

// Maps the user's own records (from loadOwnedPlants) into the shape the shared garden renders.
// Used by both the homepage hero and My Green Space so they always show the same thing.

type Session = { id: string; title: string | null; updated_at: string; context: unknown };

function statusOf(p: OwnedPlant): GardenStatus {
  if (p.identification_status === "unconfirmed") return "unconfirmed";
  if (p.insights.soil_check_due) return "soil_check_due";
  if (p.insights.light_matches === false) return "light_mismatch";
  if (p.insights.no_watering_recorded) return "no_watering_recorded";
  return "on_track";
}

export function buildGarden(owned: OwnedPlant[], { products, sessions, t, ar }: { products: ProductWithSpecies[]; sessions: Session[]; t: Dict; ar: boolean }): GardenPlant[] {
  return owned.map((p) => {
    const s = p.species;
    const sName = s ? (ar ? s.name_ar : s.name_en) : p.unconfirmed_label ?? "?";
    return {
      id: p.id, nickname: p.nickname, speciesName: sName, scientific: s?.scientific_name ?? null, speciesSlug: s?.slug ?? null,
      productSlug: s ? products.find((x) => x.species_slug === s.slug && x.kind === "plant")?.slug ?? null : null,
      image: p.photo_url ?? s?.image?.url ?? null, ownPhoto: Boolean(p.photo_url), speciesImage: s?.image?.url ?? null,
      habit: s?.habit ?? "bushy", size: s?.size ?? "medium",
      location: p.location, lightCondition: p.light_condition,
      lightLabel: p.light_condition ? t.attr.light[p.light_condition as keyof typeof t.attr.light] : null,
      needsLight: s ? s.light.map((l) => t.attr.light[l]) : [],
      waterNeed: s ? t.attr.water[s.water] : null, humidity: s ? t.attr.humidity[s.humidity] : null,
      temp: s ? `${s.temp_min_c}–${s.temp_max_c}°C` : null, difficulty: s ? t.attr.difficulty[s.difficulty] : null,
      source: p.source, addedAt: p.created_at, acquiredAt: p.acquired_at, wateringPreference: p.watering_preference, notes: p.notes,
      unconfirmed: p.identification_status === "unconfirmed", status: statusOf(p),
      daysSinceWatering: p.insights.days_since_watering, checkInterval: p.insights.typical_check_interval_days, lastWatered: p.last_watered_at,
      suggestions: ar ? p.insights.suggestions_ar : p.insights.suggestions_en,
      advice: [
        ...(p.insights.light_matches === false ? [{ key: "light" as const, text: ar ? "الإضاءة المسجلة ما تطابق احتياجها؛ فكّر تنقلها لمكان أنسب." : "The recorded light doesn't match its needs; consider moving it." }] : []),
        ...(s?.humidity === "high" ? [{ key: "ac" as const, text: ar ? "تحب الرطوبة العالية: أبعدها عن هواء المكيف المباشر." : "Likes high humidity: keep it out of direct AC airflow." }] : []),
      ],
      succulent: s?.succulent ?? false,
      tips: s ? (ar ? s.tips_ar : s.tips_en) : [], problems: s ? (ar ? s.problems_ar : s.problems_en) : [],
      observations: p.insights.recent_observations, logs: p.logs,
      consultations: sessions.filter((c) => (c.context as { focus_user_plant?: string } | null)?.focus_user_plant === p.id).slice(0, 5)
        .map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at })),
    };
  });
}

/** Species shown in the visitors' introductory garden — varied heights and growth habits. */
const SAMPLE_SLUGS = ["monstera-deliciosa", "pilea-peperomioides", "dracaena-trifasciata", "phalaenopsis-hybrid", "ficus-lyrata", "echeveria-elegans", "epipremnum-aureum"];

/**
 * A clearly-labelled sample garden built only from public catalogue data (no customer records):
 * no care history, no status, no nickname. Shown to visitors and to customers with no plants yet.
 */
export function sampleGarden(products: ProductWithSpecies[], { t, ar }: { t: Dict; ar: boolean }): GardenPlant[] {
  return SAMPLE_SLUGS.flatMap((slug) => {
    const p = products.find((x) => x.slug === slug && x.kind === "plant");
    const s = p?.species;
    if (!p || !s) return [];
    return [{
      id: `sample-${slug}`, nickname: null, speciesName: ar ? s.name_ar : s.name_en, scientific: s.scientific_name, speciesSlug: s.slug, productSlug: p.slug,
      image: s.image?.url ?? p.image?.url ?? null, ownPhoto: false, speciesImage: s.image?.url ?? null,
      habit: s.habit, size: s.size, location: null, lightCondition: null, lightLabel: null,
      needsLight: s.light.map((l) => t.attr.light[l]), waterNeed: t.attr.water[s.water], humidity: t.attr.humidity[s.humidity],
      temp: `${s.temp_min_c}–${s.temp_max_c}°C`, difficulty: t.attr.difficulty[s.difficulty],
      source: "store_purchase", addedAt: "", acquiredAt: null, wateringPreference: null, notes: null,
      unconfirmed: false, status: "on_track", daysSinceWatering: null, checkInterval: null, lastWatered: null,
      suggestions: [], advice: [], succulent: s.succulent, tips: ar ? s.tips_ar : s.tips_en, problems: ar ? s.problems_ar : s.problems_en,
      observations: [], logs: [], consultations: [],
    }];
  });
}
