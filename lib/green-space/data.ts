import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllSpecies } from "@/lib/catalog/repo";
import { plantInsights, type PlantInsights } from "./insights";
import type { Species } from "@/lib/plants/types";

export interface OwnedPlant {
  id: string;
  nickname: string | null;
  species: Species | null;
  unconfirmed_label: string | null;
  identification_status: "confirmed" | "unconfirmed";
  location: string | null;
  light_condition: string | null;
  watering_preference: string | null;
  notes: string | null;
  source: "store_purchase" | "manual";
  acquired_at: string | null;
  created_at: string;
  photo_url: string | null;
  last_watered_at: string | null;
  last_activity: { activity: string; occurred_at: string } | null;
  /** Record-based insights (same logic Nada AI uses). */
  insights: PlantInsights;
  /** Most recent care records (newest first) for the timeline. */
  logs: { id: string; activity: string; occurred_at: string; notes: string | null }[];
}

const COLS = "id, nickname, unconfirmed_label, identification_status, location, light_condition, watering_preference, notes, source, acquired_at, created_at, photo_path, species:plant_species(slug)";

/** Loads owned plants for the signed-in user (RLS-scoped), with species, photos and latest care. */
export async function loadOwnedPlants(sb: SupabaseClient, onlyId?: string): Promise<OwnedPlant[]> {
  let q = sb.from("user_plants").select(COLS).order("created_at", { ascending: false });
  if (onlyId) q = q.eq("id", onlyId);
  const { data, error } = await q;
  if (error) throw error;
  const species = await getAllSpecies();
  const ids = (data ?? []).map((p) => p.id);
  const { data: logs } = ids.length
    ? await sb.from("care_logs").select("id, user_plant_id, activity, occurred_at, notes").in("user_plant_id", ids).order("occurred_at", { ascending: false }).limit(1000)
    : { data: [] as { id: string; user_plant_id: string; activity: string; occurred_at: string; notes: string | null }[] };
  const paths = (data ?? []).map((p) => p.photo_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await sb.storage.from("plant-photos").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }
  return (data ?? []).map((p) => {
    const slug = (p.species as unknown as { slug: string } | null)?.slug;
    const mine = (logs ?? []).filter((l) => l.user_plant_id === p.id);
    const sp = species.find((s) => s.slug === slug) ?? null;
    return {
      id: p.id, nickname: p.nickname, species: sp, unconfirmed_label: p.unconfirmed_label,
      identification_status: p.identification_status, location: p.location, light_condition: p.light_condition, watering_preference: p.watering_preference,
      notes: p.notes, source: p.source, acquired_at: p.acquired_at, created_at: p.created_at,
      photo_url: p.photo_path ? signed.get(p.photo_path) ?? null : null,
      last_watered_at: mine.find((l) => l.activity === "watering")?.occurred_at ?? null,
      last_activity: mine[0] ? { activity: mine[0].activity, occurred_at: mine[0].occurred_at } : null,
      insights: plantInsights(sp, p, mine),
      logs: mine.slice(0, 40).map((l) => ({ id: l.id, activity: l.activity, occurred_at: l.occurred_at, notes: l.notes })),
    };
  });
}
