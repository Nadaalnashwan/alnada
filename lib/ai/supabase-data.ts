import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CareLogRecord, ExploredRecord, NadaData, UserPlantRecord } from "./nada";

/** NadaData backed by the user's own Supabase session: every query is constrained by RLS. */
export function supabaseNadaData(sb: SupabaseClient, userId: string, speciesIds: Map<string, string>): NadaData {
  const slugById = new Map([...speciesIds].map(([slug, id]) => [id, slug]));
  return {
    async listUserPlants() {
      const { data, error } = await sb
        .from("user_plants")
        .select("id, nickname, species_id, unconfirmed_label, location, light_condition, watering_preference, source, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const ids = (data ?? []).map((p) => p.id);
      const lastWatered = new Map<string, string>();
      if (ids.length) {
        const { data: logs } = await sb.from("care_logs").select("user_plant_id, occurred_at").eq("activity", "watering").in("user_plant_id", ids).order("occurred_at", { ascending: false }).limit(500);
        for (const l of logs ?? []) if (!lastWatered.has(l.user_plant_id)) lastWatered.set(l.user_plant_id, l.occurred_at);
      }
      return (data ?? []).map((p): UserPlantRecord => ({
        id: p.id, nickname: p.nickname, species_slug: p.species_id ? slugById.get(p.species_id) ?? null : null, unconfirmed_label: p.unconfirmed_label,
        location: p.location, light_condition: p.light_condition, watering_preference: p.watering_preference, source: p.source, created_at: p.created_at,
        last_watered_at: lastWatered.get(p.id) ?? null,
      }));
    },
    async getCareLogs(plantId, opts) {
      let q = sb.from("care_logs").select("activity, occurred_at, notes").eq("user_plant_id", plantId).order("occurred_at", { ascending: false }).limit(opts?.limit ?? 10);
      if (opts?.activity) q = q.eq("activity", opts.activity);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CareLogRecord[];
    },
    async addCareLog(plantId, activity, occurredAt, notes) {
      const { error } = await sb.from("care_logs").insert({ user_id: userId, user_plant_id: plantId, activity, occurred_at: occurredAt, notes });
      return !error;
    },
    async addUserPlant({ species_slug, nickname }) {
      const species_id = speciesIds.get(species_slug);
      if (!species_id) return null;
      const { data, error } = await sb.from("user_plants").insert({ user_id: userId, species_id, nickname, source: "manual" }).select("id").single();
      return error ? null : data.id;
    },
    async upsertExplored({ species_slug, product_id, reason }) {
      const species_id = speciesIds.get(species_slug);
      if (!species_id) return;
      await sb.from("explored_plants").upsert(
        { user_id: userId, species_id, product_id, reason: reason.slice(0, 300), source: "chat", last_explored_at: new Date().toISOString() },
        { onConflict: "user_id,species_id" },
      );
    },
    async listExplored(sinceDays) {
      let q = sb.from("explored_plants").select("species_id, product_id, reason, last_explored_at").order("last_explored_at", { ascending: false }).limit(30);
      if (sinceDays) q = q.gte("last_explored_at", new Date(Date.now() - sinceDays * 86_400_000).toISOString());
      const { data } = await q;
      return (data ?? []).map((r): ExploredRecord => ({ species_slug: slugById.get(r.species_id) ?? "", product_id: r.product_id, reason: r.reason, last_explored_at: r.last_explored_at })).filter((r) => r.species_slug);
    },
    async addToWishlist(productId) {
      const { error } = await sb.from("wishlists").upsert({ user_id: userId, product_id: productId }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
      return !error;
    },
  };
}
