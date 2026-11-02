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

/** Conversation state the server carries between turns (no personal data). */
export const ChatContextSchema = z.object({
  workflow: z.enum(["care", "rescue", "finder", "general"]).default("general"),
  preferences: PreferencesSchema.default({}),
  last_recommended: z.array(z.string().uuid()).max(10).default([]),
  focus_species: z.string().max(80).nullable().default(null),
  focus_user_plant: z.string().uuid().nullable().default(null),
  save_explored: z.boolean().default(true),
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
export interface UserPlantCardData { id: string; title: string; species: string; image: string | null; location: string | null; light: string | null; lastWatered: string | null; source: string }
export interface SpeciesCardData { slug: string; name: string; scientific: string; image: string | null; facts: { label: string; value: string }[]; productSlug: string | null }
export interface CareLogData { activity: string; occurred_at: string; notes: string | null }

export type ChatBlock =
  | { type: "products"; title: string; items: ProductCardData[] }
  | { type: "user_plants"; title: string; items: UserPlantCardData[] }
  | { type: "species"; item: SpeciesCardData }
  | { type: "checklist"; title: string; items: string[]; tone: "care" | "rescue" }
  | { type: "care_logs"; title: string; plantId: string; items: CareLogData[] }
  | { type: "action"; status: "success" | "failed" | "needs_auth" | "needs_choice"; message: string; choices?: { id: string; label: string }[] }
  | { type: "save_observation"; plantId: string; note: string };

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
