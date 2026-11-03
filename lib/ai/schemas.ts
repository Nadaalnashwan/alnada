// Structured contracts between Meta Llama and the application.
// The model only ever produces data matching these schemas; it never executes queries.
import { z } from "zod";
import { PreferencesSchema } from "@/lib/recommendations/engine";

export const INTENTS = [
  "recommend_plant",
  "cheaper_options",
  "get_plant_care",
  "investigate_plant_problem",
  "get_my_plants",
  "get_plant_history",
  "get_explored_history",
  "save_care_log",
  "save_plant",
  "save_to_wishlist",
  "add_to_cart",
  "compare_plants",
  "general_question",
  "clarify_request",
] as const;
export type Intent = (typeof INTENTS)[number];

export const CARE_ACTIVITIES = ["watering", "fertilizing", "repotting", "pruning", "cleaning", "observation"] as const;

const nullableStr = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

/** Output of the intent-understanding call. Lenient on optional fields, strict on enums. */
export const UnderstandingSchema = z.object({
  intent: z.enum(INTENTS),
  language: z.enum(["ar", "en"]).catch("ar"),
  preferences: PreferencesSchema.partial().nullish().transform((v) => v ?? {}),
  species_mentions: z.array(z.string().trim().min(1).max(80)).max(4).nullish().transform((v) => v ?? []),
  plant_nickname: nullableStr(60),
  symptoms: z.array(z.string().trim().max(160)).max(8).nullish().transform((v) => v ?? []),
  care_activity: z.enum(CARE_ACTIVITIES).nullish().transform((v) => v ?? null),
  activity_when: z.enum(["today", "yesterday", "days_ago"]).nullish().transform((v) => v ?? null),
  activity_days_ago: z.number().int().min(0).max(365).nullish().transform((v) => v ?? null),
  reference_index: z.number().int().min(1).max(10).nullish().transform((v) => v ?? null),
  time_range_days: z.number().int().min(1).max(365).nullish().transform((v) => v ?? null),
  observation_note: nullableStr(300),
});
export type Understanding = z.infer<typeof UnderstandingSchema>;

/**
 * One plant Nada referred to. `key` is stable: the catalogue product id, else `sp:<species slug>`, else
 * `n:<normalised name>` for a botanical suggestion that is not in AL NADA's verified data.
 */
export const RefItemSchema = z.object({
  key: z.string().max(120),
  name_ar: z.string().max(80),
  name_en: z.string().max(80),
  scientific: z.string().max(120).nullable(),
  species_slug: z.string().max(80).nullable(),
  product_id: z.string().uuid().nullable(),
});
export type RefItem = z.infer<typeof RefItemSchema>;

/** An ordered group of plants Nada presented in one turn (store picks or a list in her reply). */
export const RecSetSchema = z.object({ id: z.number().int().min(0), source: z.enum(["store", "reply"]), items: z.array(RefItemSchema).min(1).max(6) });
export type RecSet = z.infer<typeof RecSetSchema>;
export const MAX_REC_SETS = 6;

/** Conversation state the server carries between turns (no personal data). */
export const ChatContextSchema = z.object({
  workflow: z.enum(["care", "rescue", "finder", "general"]).default("general"),
  preferences: PreferencesSchema.default({}),
  last_recommended: z.array(z.string().uuid()).max(10).default([]),
  focus_species: z.string().max(80).nullable().default(null),
  focus_user_plant: z.string().uuid().nullable().default(null),
  save_explored: z.boolean().default(true),
  // Reference memory (all optional so contexts saved before this existed still parse):
  turn: z.number().int().min(0).default(0),
  /** Recent recommendation groups, oldest first, each in its original order. */
  rec_sets: z.array(RecSetSchema).max(MAX_REC_SETS).default([]),
  /** id of the group "الأولى/الثانية" refer to — the latest one presented. */
  active_set: z.number().int().min(0).nullable().default(null),
  /** The single plant currently being discussed ("هذي", "أضيفيها"); never reorders the active group. */
  focus_item: RefItemSchema.nullable().default(null),
  /** Keys of the plants in the latest comparison ("أي وحدة أرخص؟" is answered among these). */
  compared: z.array(z.string().max(120)).max(4).default([]),
  /** Last cart/wishlist action — answers "وش أضفتي؟" and blocks accidental duplicates. */
  /** Which kind of plant the conversation focused on last, so "هي / أسقيها" follow-ups resolve correctly. */
  last_focus: z.enum(["user_plant", "item"]).nullable().default(null),
  last_action: z.object({ type: z.enum(["cart", "wishlist"]), item: RefItemSchema, message: z.string().max(200), turn: z.number().int().min(0) }).nullable().default(null),
});
export type ChatContext = z.infer<typeof ChatContextSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(1500),
  sessionId: z.string().uuid().nullish(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20).default([]),
  context: ChatContextSchema.partial().nullish(),
  workflow: z.enum(["care", "rescue", "finder", "general"]).nullish(),
  userPlantId: z.string().uuid().nullish(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ───────── rich UI payload returned to the client ─────────
export interface ProductCardData { id: string; slug: string; name: string; scientific: string; price: number; image: string | null; stock: number; reasons: string[]; cautions: string[]; rank?: number }
export interface UserPlantCardData {
  id: string; title: string; species: string; image: string | null; location: string | null; light: string | null; lastWatered: string | null; source: string;
  /** Deterministic flags from saved data only (see lib/green-space/insights.ts). */
  flags?: ("soil_check_due" | "light_mismatch" | "no_watering_recorded" | "recent_observation")[];
}
export interface SpeciesCardData { slug: string; name: string; scientific: string; image: string | null; facts: { label: string; value: string }[]; productSlug: string | null }
export interface CareLogData { activity: string; occurred_at: string; notes: string | null }

export type ChatBlock =
  | { type: "products"; title: string; items: ProductCardData[] }
  | { type: "user_plants"; title: string; items: UserPlantCardData[] }
  | { type: "species"; item: SpeciesCardData }
  | { type: "checklist"; title: string; items: string[]; tone: "care" | "rescue" }
  | { type: "care_logs"; title: string; plantId: string; items: CareLogData[] }
  | { type: "action"; status: "success" | "failed" | "needs_auth" | "needs_choice"; message: string; choices?: { id: string; label: string }[] }
  | { type: "save_observation"; plantId: string; note: string }
  | { type: "notice"; message: string };

export interface ChatResponse {
  reply: string;
  /** True when actions/data succeeded but the Llama text reply failed; the UI shows an error note. */
  replyError?: boolean;
  /** Development only: what the model understood and what the server used. Never set in production. */
  debug?: { understanding: unknown; facts: unknown };
  blocks: ChatBlock[];
  context: ChatContext;
  sessionId: string | null;
  intent: Intent;
  clientActions: { type: "add_to_cart"; productId: string }[];
  model: string;
}
