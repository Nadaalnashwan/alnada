// Nada AI orchestration:
// message → Llama intent understanding → Zod validation → authorised data retrieval
// → botanical knowledge + deterministic recommendation/care logic → Llama response → rich UI blocks.
//
// Dependencies (model + user-scoped data access) are injected so the pipeline is testable and the
// model can never reach the database: it only fills the Understanding schema.

import { plantInsights, type PlantInsights } from "@/lib/green-space/insights";
import type { Locale } from "@/lib/i18n/dict";
import { DICTS } from "@/lib/i18n/dict";
import type { ProductWithSpecies, Species } from "@/lib/plants/types";
import { PreferencesSchema, recommend, type Preferences } from "@/lib/recommendations/engine";
import {
  activeSet, answerCriterion, asksForMore, asksForProduct, asksForRecommendations, detectCriterion, extractReplyList, findItem, isCompareRequest,
  isLastActionQuestion, itemFromProduct, itemFromSpecies, itemName, pushRecSet, resolveReference, sameRequest, storeProductsFor, wantsCart, wantsWishlist,
  type Resolution,
} from "./conversation";
import type { LlamaChat, LlamaMessage } from "./llama";
import { RESPOND_SYSTEM, RESPOND_SYSTEM_EN, UNDERSTAND_SYSTEM } from "./prompts";
import {
  ChatContextSchema,
  UnderstandingSchema,
  type ChatBlock,
  type ChatContext,
  type ChatResponse,
  type Intent,
  type ProductCardData,
  type RefItem,
  type Understanding,
  type UserPlantCardData,
} from "./schemas";
import { matchSpecies, norm, resolveSpecies } from "./species-match";
import { findUserPlantMentions, isNicknameOf, normalizeArabic, refersToCurrentPlant } from "./user-plant-match";

export { resolveSpecies };

// ───────────────────────── data port ─────────────────────────
export interface UserPlantRecord {
  id: string;
  nickname: string | null;
  species_slug: string | null;
  unconfirmed_label: string | null;
  location: string | null;
  light_condition: string | null;
  watering_preference: string | null;
  source: "store_purchase" | "manual";
  created_at: string;
  last_watered_at: string | null;
}
export interface CareLogRecord { activity: string; occurred_at: string; notes: string | null }
export interface ExploredRecord { species_slug: string; product_id: string | null; reason: string | null; last_explored_at: string }

/** All methods act as the signed-in user; implementations must rely on RLS for authorisation. */
export interface NadaData {
  listUserPlants(): Promise<UserPlantRecord[]>;
  getCareLogs(plantId: string, opts?: { activity?: string; limit?: number }): Promise<CareLogRecord[]>;
  addCareLog(plantId: string, activity: string, occurredAt: string, notes: string | null): Promise<boolean>;
  addUserPlant(input: { species_slug: string; nickname: string | null }): Promise<string | null>;
  upsertExplored(input: { species_slug: string; product_id: string | null; reason: string }): Promise<void>;
  listExplored(sinceDays: number | null): Promise<ExploredRecord[]>;
  addToWishlist(productId: string): Promise<boolean>;
}

export interface NadaDeps {
  llm: LlamaChat;
  model: string;
  products: ProductWithSpecies[];
  species: Species[];
  user: { id: string } | null;
  data: NadaData | null;
  logRecommendation?: (criteria: Record<string, unknown>, productIds: string[]) => Promise<void>;
  now?: () => Date;
}

export interface NadaInput {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  context: Partial<ChatContext> | null | undefined;
  workflow?: ChatContext["workflow"] | null;
  userPlantId?: string | null;
  sessionId: string | null;
}

// ───────────────────────── helpers ─────────────────────────
function riyadhDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function plantTitle(p: UserPlantRecord, species: Species | null, locale: Locale) {
  const sp = species ? (locale === "ar" ? species.name_ar : species.name_en) : p.unconfirmed_label ?? "?";
  return p.nickname ? `${sp} — ${p.nickname}` : sp;
}

function productCard(p: ProductWithSpecies, locale: Locale, reasons: string[] = [], cautions: string[] = [], rank?: number): ProductCardData {
  return {
    id: p.id, slug: p.slug, name: locale === "ar" ? p.name_ar : p.name_en, scientific: p.species?.scientific_name ?? "",
    price: p.price_sar, image: p.image?.thumb_url ?? p.image?.url ?? null, stock: p.stock, reasons, cautions, rank,
  };
}

function speciesFacts(s: Species, locale: Locale) {
  const t = DICTS[locale];
  return [
    { label: t.product.light, value: s.light.map((l) => t.attr.light[l]).join(locale === "ar" ? "، " : ", ") },
    { label: t.product.water, value: t.attr.water[s.water] },
    { label: t.product.humidity, value: t.attr.humidity[s.humidity] },
    { label: t.product.temperature, value: `${s.temp_min_c}–${s.temp_max_c}°C` },
    { label: t.product.difficulty, value: t.attr.difficulty[s.difficulty] },
    { label: `${t.product.pets} (${t.product.cats}/${t.product.dogs})`, value: `${t.attr.tox[s.toxicity.cats]} / ${t.attr.tox[s.toxicity.dogs]}` },
  ];
}

/** Compact botanical facts for the model (no personal data). */
function speciesKnowledge(s: Species, locale: Locale = "ar") {
  return {
    name: locale === "ar" ? s.name_ar : s.name_en, scientific: s.scientific_name, light: s.light, water: s.water, humidity: s.humidity,
    temp_c: [s.temp_min_c, s.temp_max_c], placement: s.placement, difficulty: s.difficulty, heat_tolerant: s.heat_tolerant,
    pet_toxicity: { cats: s.toxicity.cats, dogs: s.toxicity.dogs, source: s.toxicity.source ?? "not listed by ASPCA" },
    tips: locale === "ar" ? s.tips_ar : s.tips_en, common_problems: locale === "ar" ? s.problems_ar : s.problems_en,
  };
}

function careChecklist(s: Species, locale: Locale): string[] {
  const ar = locale === "ar";
  const water = { low: ar ? "اسقها فقط لما تجف التربة تمامًا" : "Water only when the soil is fully dry", moderate: ar ? "اسقها لما تجف أول ٣–٥ سم من التربة" : "Water when the top 3–5 cm is dry", high: ar ? "خل التربة رطبة باستمرار بدون تشبع" : "Keep soil evenly moist, never soggy" }[s.water];
  const light = s.light.includes("bright_indirect") ? (ar ? "مكان مضيء بدون شمس مباشرة حارقة" : "Bright spot without harsh direct sun") : s.light.includes("full_sun") ? (ar ? "أكبر قدر من الشمس مع تعويد تدريجي" : "As much sun as possible, acclimatised gradually") : (ar ? "تتحمل الإضاءة الخفيفة، بعيدًا عن الشمس المباشرة" : "Tolerates low light, away from direct sun");
  const humid = s.humidity === "high" ? (ar ? "ارفع الرطوبة: جهاز ترطيب أو صينية حصى، وأبعدها عن المكيف" : "Raise humidity (humidifier or pebble tray), away from AC") : (ar ? "أبعدها عن هواء المكيف المباشر" : "Keep away from direct AC airflow");
  return [water, light, humid, ar ? "تأكد إن الأصيص فيه فتحة تصريف وفرّغ الصحن بعد الري" : "Use a pot with drainage and empty the saucer after watering", ...(ar ? s.tips_ar : s.tips_en)];
}

function rescueChecklist(locale: Locale): string[] {
  return locale === "ar"
    ? ["افحص رطوبة التربة بإصبعك على عمق ٣–٥ سم قبل أي ري", "تأكد من فتحات التصريف وإن الماء ما يتجمع في الصحن", "شيك على الجذور: البيضاء القاسية سليمة، والبنية الطرية علامة تعفن", "قارن مكانها بإضاءتها المناسبة وأبعدها عن المكيف", "شيل الأوراق التالفة تمامًا فقط، وراقب النمو الجديد أسبوعين", "لا تسمّد نبتة متعبة حتى تتعافى"]
    : ["Check soil moisture 3–5 cm deep before any watering", "Confirm drainage holes and no standing water in the saucer", "Inspect roots: firm white is healthy, brown mushy suggests rot", "Match its spot to its light needs and keep it away from AC", "Remove only fully damaged leaves; watch new growth for two weeks", "Don't fertilise a stressed plant until it recovers"];
}

// ───────────────────────── main ─────────────────────────
export async function runNada(input: NadaInput, deps: NadaDeps): Promise<ChatResponse> {
  const now = deps.now?.() ?? new Date();
  const ctx: ChatContext = ChatContextSchema.parse({ ...(input.context ?? {}), ...(input.workflow ? { workflow: input.workflow } : {}) });
  // Contexts saved before recommendation groups existed: their last store picks become the active group.
  if (!ctx.rec_sets.length && ctx.last_recommended.length) {
    const legacy = ctx.last_recommended.map((id) => deps.products.find((p) => p.id === id)).filter((p): p is ProductWithSpecies => !!p).map(itemFromProduct);
    if (legacy.length) { ctx.rec_sets = [{ id: ctx.turn, source: "store", items: legacy }]; ctx.active_set = ctx.turn; }
  }
  ctx.turn += 1;
  const history = input.history.slice(-8);
  const speciesBySlug = new Map(deps.species.map((s) => [s.slug, s]));

  // 1) Understanding (Llama → JSON → Zod). One retry on invalid output.
  const plants = deps.user && deps.data ? await deps.data.listUserPlants() : [];
  const understandMsgs: LlamaMessage[] = [
    { role: "system", content: UNDERSTAND_SYSTEM },
    {
      role: "system",
      content: `Context: workflow=${ctx.workflow}; signed_in=${Boolean(deps.user)}; user_saved_plants=${JSON.stringify(plants.filter((p) => p.nickname).map((p) => ({ nickname: p.nickname, species: p.species_slug ? speciesBySlug.get(p.species_slug)?.name_en ?? null : p.unconfirmed_label })))}; previous_preferences=${JSON.stringify(ctx.preferences)}; last_recommended_count=${ctx.last_recommended.length}; active_recommendations_in_order=${JSON.stringify(activeSet(ctx)?.items.map((i) => i.name_ar || i.name_en) ?? [])}`,
    },
    ...history.map((h) => ({ role: h.role, content: h.content }) as LlamaMessage),
    { role: "user", content: input.message },
  ];
  let u: Understanding | null = null;
  for (let attempt = 0; attempt < 2 && !u; attempt++) {
    const raw = await deps.llm(understandMsgs, { json: true, temperature: 0, maxTokens: 500 });
    try {
      const parsed = UnderstandingSchema.safeParse(JSON.parse(extractJson(raw)));
      if (parsed.success) u = parsed.data;
    } catch {
      /* invalid JSON → retry */
    }
  }
  if (!u) u = UnderstandingSchema.parse({ intent: "clarify_request", language: /[؀-ۿ]/.test(input.message) ? "ar" : "en" });
  // Deterministic backstop: clear symptom language always routes to the rescue workflow.
  if ((u.intent === "get_plant_care" || u.intent === "general_question" || u.intent === "get_my_plants" || u.intent === "save_care_log" || u.intent === "clarify_request") && SYMPTOMS.test(input.message)) {
    u = { ...u, intent: "investigate_plant_problem", symptoms: u.symptoms.length ? u.symptoms : [input.message.slice(0, 160)] };
  }
  // A care log is only written for a completed action in the past tense ("سقيت", "watered"), never for
  // habits ("أسقيها يوميًا") or plans — otherwise we would store a false record.
  if (u.intent === "save_care_log" && !CARE_DONE.test(input.message)) u = { ...u, intent: "get_plant_care" };
  // References to plants Nada already presented ("الأولى", "قارني بينهم", "أضيفيها") are resolved
  // deterministically against the latest recommendation group — never left to the model alone.
  // The customer's own saved plants come first: a nickname typed in the message ("لفله", "بالفلة") is
  // their plant — never a generic species guess and never a recommendation from earlier in the chat.
  const mentions = deps.user ? findUserPlantMentions(input.message, plants, deps.species) : { byNickname: [] as UserPlantRecord[], bySpecies: [] as UserPlantRecord[] };
  const SHOPPING_INTENTS: Intent[] = ["add_to_cart", "save_to_wishlist", "recommend_plant", "cheaper_options", "save_plant", "compare_plants"];
  const personal = mentions.byNickname.length > 0 && !SHOPPING_INTENTS.includes(u.intent);
  if (personal) {
    u = {
      ...u,
      plant_nickname: mentions.byNickname[0].nickname,
      // Model "species" that are really the nickname would otherwise become a wrong species guess.
      species_mentions: u.species_mentions.filter((m) => !isNicknameOf(m, mentions.byNickname)),
      intent: u.intent === "general_question" || u.intent === "clarify_request" ? "get_plant_care" : u.intent,
    };
  }
  let ref: Resolution = input.userPlantId || u.plant_nickname ? { kind: "none" } : resolveReference(input.message, ctx);
  // "هي / أسقيها / فيها" right after talking about their own plant means that plant, not a recommendation.
  const followsOwnPlant = !personal && !input.userPlantId && ctx.last_focus === "user_plant" && !!ctx.focus_user_plant && plants.some((p) => p.id === ctx.focus_user_plant);
  if (followsOwnPlant && (ref.kind === "ambiguous" || (ref.kind === "items" && ref.via === "focus") || (ref.kind === "missing" && ref.reason === "no_focus"))) ref = { kind: "none" };
  if (followsOwnPlant && ref.kind === "none" && (u.intent === "general_question" || u.intent === "clarify_request") && refersToCurrentPlant(input.message)) u = { ...u, intent: "get_plant_care" };
  const criterion = ctx.rec_sets.length || ctx.compared.length ? detectCriterion(input.message) : null;
  const OWN_PLANT_INTENTS: Intent[] = ["get_my_plants", "get_plant_history", "save_care_log", "save_plant", "get_explored_history", "investigate_plant_problem"];
  if (ref.kind !== "none" && !OWN_PLANT_INTENTS.includes(u.intent)) {
    if (wantsCart(input.message) && u.intent !== "save_to_wishlist") u = { ...u, intent: "add_to_cart" };
    else if (wantsWishlist(input.message)) u = { ...u, intent: "save_to_wishlist" };
    else if (isCompareRequest(input.message)) u = { ...u, intent: "compare_plants" };
    else if (criterion) u = { ...u, intent: "compare_plants" };
    else if (isLastActionQuestion(input.message)) u = { ...u, intent: "general_question" };
  } else if (criterion && !OWN_PLANT_INTENTS.includes(u.intent) && u.intent !== "save_to_wishlist" && u.intent !== "add_to_cart" && u.intent !== "cheaper_options") {
    u = { ...u, intent: "compare_plants" };
  }
  // Reply language follows the user's own message script, not the model's guess.
  const arabicChars = (input.message.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinChars = (input.message.match(/[A-Za-z]/g) ?? []).length;
  if (arabicChars || latinChars) u = { ...u, language: arabicChars >= latinChars ? "ar" : "en" };
  const locale: Locale = u.language;
  const ar = locale === "ar";

  // Explicit selection from the UI wins over model interpretation.
  const selectedPlant = input.userPlantId ? plants.find((p) => p.id === input.userPlantId) ?? null : null;

  const blocks: ChatBlock[] = [];
  const clientActions: ChatResponse["clientActions"] = [];
  const facts: Record<string, unknown> = { intent: u.intent, today: riyadhDate(now), signed_in: Boolean(deps.user) };
  let intent: Intent = u.intent;

  const needAuth = () => {
    const msg = ar ? "هذي الميزة تحتاج تسجيل دخول عشان نوصل لمساحتك الخضراء بأمان." : "Please sign in so I can securely access your Green Space.";
    blocks.push({ type: "action", status: "needs_auth", message: msg });
    facts.action = { status: "needs_auth" };
  };

  /** Resolve which saved plant the user means: UI selection → nickname → species mention → focus. */
  /** Mentions the customer actually typed (the model sometimes carries names over from history). */
  const typed = (m: string) => normalizeArabic(input.message).includes(normalizeArabic(m).replace(/^ال/, ""));
  let touchedUserPlant = false;
  /**
   * Which saved plant the customer means: a nickname typed in this message → the plant selected in the
   * sidebar → the model's nickname → a species they own → the plant already being discussed.
   */
  const resolveUserPlant = (): { plant: UserPlantRecord | null; ambiguous: UserPlantRecord[] } => {
    const r = resolveUserPlantInner();
    if (r.plant) touchedUserPlant = true;
    return r;
  };
  const resolveUserPlantInner = (): { plant: UserPlantRecord | null; ambiguous: UserPlantRecord[] } => {
    if (mentions.byNickname.length === 1) return { plant: mentions.byNickname[0], ambiguous: [] };
    if (mentions.byNickname.length > 1) return { plant: null, ambiguous: mentions.byNickname };
    if (selectedPlant) return { plant: selectedPlant, ambiguous: [] };
    if (u!.plant_nickname) {
      const n = normalizeArabic(u!.plant_nickname).replace(/^ال/, "");
      const hits = plants.filter((p) => p.nickname && normalizeArabic(p.nickname).replace(/^ال/, "") === n);
      if (hits.length === 1) return { plant: hits[0], ambiguous: [] };
      if (hits.length > 1) return { plant: null, ambiguous: hits };
    }
    for (const m of u!.species_mentions) {
      const sp = resolveSpecies(m, deps.species);
      const hits = sp ? plants.filter((p) => p.species_slug === sp.slug) : [];
      if (hits.length === 1) return { plant: hits[0], ambiguous: [] };
      if (hits.length > 1) return { plant: null, ambiguous: hits };
    }
    if (ctx.focus_user_plant) {
      const p = plants.find((x) => x.id === ctx.focus_user_plant);
      if (p && !u!.species_mentions.some(typed) && !u!.plant_nickname) return { plant: p, ambiguous: [] };
    }
    return { plant: null, ambiguous: [] };
  };

  const askWhichPlant = (list: UserPlantRecord[]) => {
    blocks.push({
      type: "action", status: "needs_choice",
      message: ar ? "عندك أكثر من نبتة بهذا الاسم، أي وحدة تقصد؟" : "You have more than one plant matching that — which one?",
      choices: list.map((p) => ({ id: p.id, label: plantTitle(p, p.species_slug ? speciesBySlug.get(p.species_slug) ?? null : null, locale) + (p.location ? ` · ${p.location}` : "") })),
    });
    facts.action = { status: "needs_choice", options: list.length };
  };

  const insightsCache = new Map<string, { logs: CareLogRecord[]; insights: PlantInsights }>();
  const loadInsights = async (p: UserPlantRecord) => {
    const hit = insightsCache.get(p.id);
    if (hit) return hit;
    const sp = p.species_slug ? speciesBySlug.get(p.species_slug) ?? null : null;
    const logs = deps.data ? await deps.data.getCareLogs(p.id, { limit: 20 }) : [];
    const value = { logs, insights: plantInsights(sp, p, logs, now) };
    insightsCache.set(p.id, value);
    return value;
  };

  /** Minimal, relevant customer data for the model: no names/emails, only this plant's own records. */
  const plantFacts = async (p: UserPlantRecord) => {
    const sp = p.species_slug ? speciesBySlug.get(p.species_slug) ?? null : null;
    const { logs, insights } = await loadInsights(p);
    return {
      sp,
      logs,
      insights,
      fact: {
        nickname: p.nickname, species: sp ? speciesKnowledge(sp, locale) : { unconfirmed_description: p.unconfirmed_label },
        location: p.location, light_condition: p.light_condition, watering_preference: p.watering_preference,
        source: p.source, added: p.created_at.slice(0, 10), last_watered: p.last_watered_at?.slice(0, 10) ?? null,
        recent_care_logs: logs.slice(0, 8).map((l) => ({ activity: l.activity, date: l.occurred_at.slice(0, 10), notes: l.notes })),
        // Computed from saved records only; the model must present these as "based on your records".
        record_based_insights: {
          days_since_recorded_watering: insights.days_since_watering,
          typical_soil_check_interval_days: insights.typical_check_interval_days,
          soil_check_due: insights.soil_check_due,
          recorded_light_matches_species: insights.light_matches,
          recent_observations: insights.recent_observations,
          suggestions: ar ? insights.suggestions_ar : insights.suggestions_en,
        },
      },
    };
  };

  const flagsFor = (i: PlantInsights): NonNullable<UserPlantCardData["flags"]> => [
    ...(i.soil_check_due ? (["soil_check_due"] as const) : []),
    ...(i.light_matches === false ? (["light_mismatch"] as const) : []),
    ...(i.no_watering_recorded ? (["no_watering_recorded"] as const) : []),
    ...(i.recent_observations.length ? (["recent_observation"] as const) : []),
  ];

  const userPlantCard = (p: UserPlantRecord, insights?: PlantInsights): UserPlantCardData => {
    const sp = p.species_slug ? speciesBySlug.get(p.species_slug) ?? null : null;
    return {
      id: p.id, title: plantTitle(p, sp, locale), species: sp?.scientific_name ?? (ar ? "تعريف غير مؤكد" : "Unconfirmed ID"),
      image: sp?.image?.thumb_url ?? null, location: p.location, light: p.light_condition ? DICTS[locale].attr.light[p.light_condition as "low"] ?? p.light_condition : null,
      lastWatered: p.last_watered_at, source: p.source, flags: insights ? flagsFor(insights) : undefined,
    };
  };

  /** Store products that address a real, record-based need (never generic upselling). */
  const helpfulProducts = (i: PlantInsights) =>
    deps.products.filter((pr) => i.helpful_product_slugs.includes(pr.slug) && pr.stock > 0).slice(0, 2).map((pr) => productCard(pr, locale));

  const recordExplored = async (sp: Species, reason: string, productId: string | null = null) => {
    if (deps.data && ctx.save_explored) await deps.data.upsertExplored({ species_slug: sp.slug, product_id: productId, reason }).catch(() => {});
  };

  const speciesBlock = (sp: Species) => {
    const product = deps.products.find((p) => p.species_slug === sp.slug && p.kind === "plant") ?? null;
    blocks.push({ type: "species", item: { slug: sp.slug, name: ar ? sp.name_ar : sp.name_en, scientific: sp.scientific_name, image: sp.image?.thumb_url ?? null, facts: speciesFacts(sp, locale), productSlug: product?.slug ?? null } });
  };

  // ── plants from the conversation's recommendation groups ──
  const speciesOf = (i: RefItem) => (i.species_slug ? speciesBySlug.get(i.species_slug) ?? null : null);
  /** Verified facts for one referenced plant; store data only when this exact species is sold. */
  const refFact = (i: RefItem) => {
    const sp = speciesOf(i);
    const prods = storeProductsFor(i, deps.products);
    const prices = prods.map((p) => p.price_sar);
    return {
      name: itemName(i, ar), scientific: i.scientific ?? sp?.scientific_name ?? null,
      verified_botanical_data: sp ? speciesKnowledge(sp, locale) : null,
      store: prods.length
        ? { sold_in_al_nada: true, price_sar: prices.length === 1 ? prices[0] : { from: Math.min(...prices), to: Math.max(...prices) }, in_stock: prods.some((p) => p.stock > 0) }
        : { sold_in_al_nada: false },
    };
  };
  const unavailableNotice = (i: RefItem) => blocks.push({
    type: "notice",
    message: ar
      ? `${itemName(i, true)} غير متوفرة في متجر الندى${speciesOf(i) ? "" : "، وما عندنا عنها بيانات نباتية موثقة"} — ما راح نعرض منتج ثاني بدالها.`
      : `${itemName(i, false)} isn't sold at AL NADA${speciesOf(i) ? "" : " and isn't in our verified plant data"} — we won't show a different product in its place.`,
  });
  const showItem = (i: RefItem, withProducts: boolean) => {
    const sp = speciesOf(i);
    if (sp) speciesBlock(sp);
    const prods = storeProductsFor(i, deps.products);
    if (!prods.length) unavailableNotice(i);
    else if (withProducts) blocks.push({ type: "products", title: ar ? "في متجر الندى" : "At AL NADA", items: prods.slice(0, 3).map((p) => productCard(p, locale)) });
  };
  const askWhichItem = (options: RefItem[]) => {
    blocks.push({ type: "action", status: "needs_choice", message: ar ? "تقصد أي نبتة بالضبط؟" : "Which plant exactly do you mean?", choices: options.slice(0, 6).map((o) => ({ id: o.key, label: itemName(o, ar) })) });
    facts.clarify_reference = options.map((o) => itemName(o, ar));
  };
  const referenceProblem = (r: Extract<Resolution, { kind: "missing" }>) => {
    facts.reference_problem = { no_group: "No plants have been recommended in this conversation yet.", out_of_range: "That position does not exist in the latest recommendation list.", no_focus: "It is unclear which plant the customer means." }[r.reason];
    facts.active_recommendations = activeSet(ctx)?.items.map((i) => itemName(i, ar)) ?? [];
  };
  /** Names the customer typed, matched strictly; unknown names stay unverified instead of becoming another plant. */
  const itemsFromMentions = (): { items: RefItem[]; ambiguous: RefItem[] | null } => {
    const items: RefItem[] = [];
    for (const m of u!.species_mentions) {
      const r = matchSpecies(m, deps.species);
      if (r.match) items.push(activeSet(ctx)?.items.find((i) => i.species_slug === r.match!.slug) ?? itemFromSpecies(r.match));
      else if (r.candidates.length) return { items: [], ambiguous: r.candidates.map(itemFromSpecies) };
      else items.push({ key: `n:${norm(m)}`.slice(0, 120), name_ar: m, name_en: m, scientific: null, species_slug: null, product_id: null });
    }
    return { items: [...new Map(items.map((i) => [i.key, i])).values()], ambiguous: null };
  };

  // 2) Authorised retrieval + deterministic logic per intent.
  let storeSet = false;
  const focusItemBefore = ctx.focus_item?.key ?? null;
  const discuss = ref.kind !== "none" && (u.intent === "general_question" || u.intent === "get_plant_care" || u.intent === "clarify_request");
  if (discuss) {
    // "وش كانت الثانية؟", "حدثيني عن الأولى", "وش أضفتي؟", "وريني صفحتها" — about plants already presented.
    if (u.intent === "clarify_request") intent = "general_question";
    if (ref.kind === "ambiguous") askWhichItem(ref.options);
    else if (ref.kind === "missing") referenceProblem(ref);
    else if (ref.kind === "items") {
      const items = ref.items.slice(0, 3);
      facts.referenced = items.map(refFact);
      facts.reference_note = ref.via === "last_action" ? "This is exactly what was added in the last cart/wishlist action." : "The customer means exactly these plants from the conversation, in this order.";
      if (items.length === 1) ctx.focus_item = items[0];
      const wantProduct = asksForProduct(input.message);
      for (const i of items) {
        const sp = speciesOf(i);
        showItem(i, wantProduct);
        if (sp && u.intent === "get_plant_care" && items.length === 1) blocks.push({ type: "checklist", title: ar ? "قائمة عناية" : "Care checklist", items: careChecklist(sp, locale), tone: "care" });
        if (sp) await recordExplored(sp, ar ? "سألت عنها" : "Asked about it");
      }
    }
  } else switch (u.intent) {
    case "recommend_plant":
    case "cheaper_options": {
      ctx.workflow = ctx.workflow === "general" ? "finder" : ctx.workflow;
      const merged: Preferences = PreferencesSchema.parse({ ...ctx.preferences, ...stripNulls(u.preferences), ...detectHardPreferences(input.message, u.preferences) });
      let excludeIds: string[] = [];
      let sort: "score" | "price_asc" = "score";
      if (u.intent === "cheaper_options" && ctx.last_recommended.length) {
        const prev = deps.products.filter((p) => ctx.last_recommended.includes(p.id));
        const cheapest = Math.min(...prev.map((p) => p.price_sar));
        merged.budget_max_sar = Math.min(merged.budget_max_sar ?? Infinity, cheapest - 1);
        excludeIds = ctx.last_recommended;
        sort = "price_asc";
      }
      ctx.preferences = merged;
      const result = recommend(deps.products, merged, { limit: 3, excludeProductIds: excludeIds, sort });
      const items = result.results.map((r, i) => productCard(r.product, locale, ar ? r.reasons_ar : r.reasons_en, ar ? r.cautions_ar : r.cautions_en, i + 1));
      if (items.length) {
        pushRecSet(ctx, "store", result.results.map((r) => itemFromProduct(r.product)));
        storeSet = true;
        blocks.push({ type: "products", title: ar ? "اقتراحات ندى من متجرنا" : "Nada's picks from our store", items });
        for (const r of result.results) await recordExplored(r.product.species!, ar ? "اقترحتها ندى" : "Recommended by Nada", r.product.id);
      }
      await deps.logRecommendation?.(
        { placement: merged.placement ?? null, light: merged.light ?? null, pets: merged.pets ?? [], budget_band: merged.budget_max_sar ? Math.ceil(merged.budget_max_sar / 50) * 50 : null, low_maintenance: Boolean(merged.maintenance === "low" || merged.travels_often), hot_climate: Boolean(merged.afternoon_sun) },
        items.map((i) => i.id),
      ).catch(() => {});
      facts.preferences_used = merged;
      facts.recommendations = result.results.map((r) => ({ name: ar ? r.product.name_ar : r.product.name_en, scientific: r.product.species!.scientific_name, price_sar: r.product.price_sar, reasons: ar ? r.reasons_ar : r.reasons_en, cautions: ar ? r.cautions_ar : r.cautions_en }));
      facts.no_match = items.length === 0;
      facts.excluded_counts = result.excluded;
      facts.missing_preferences = (["placement", "light", "pets", "budget_max_sar"] as const).filter((k) => merged[k] === undefined);
      break;
    }

    case "get_plant_care":
    case "investigate_plant_problem": {
      const rescue = u.intent === "investigate_plant_problem";
      ctx.workflow = rescue ? "rescue" : "care";
      const { plant, ambiguous } = deps.user ? resolveUserPlant() : { plant: null, ambiguous: [] as UserPlantRecord[] };
      if (ambiguous.length) { askWhichPlant(ambiguous); break; }
      if (plant) {
        ctx.focus_user_plant = plant.id;
        const { sp, logs, fact, insights } = await plantFacts(plant);
        facts.user_plant = fact;
        blocks.push({ type: "user_plants", title: ar ? "نبتتك" : "Your plant", items: [userPlantCard(plant, insights)] });
        if (logs.length) blocks.push({ type: "care_logs", title: ar ? "آخر نشاط مسجل" : "Recent recorded activity", plantId: plant.id, items: logs.slice(0, 5) });
        if (sp) ctx.focus_species = sp.slug;
        blocks.push({ type: "checklist", title: rescue ? (ar ? "خطة فحص وإنقاذ آمنة" : "Safe check & rescue plan") : (ar ? "قائمة عناية" : "Care checklist"), items: rescue ? rescueChecklist(locale) : sp ? careChecklist(sp, locale) : rescueChecklist(locale), tone: rescue ? "rescue" : "care" });
        const helpers = helpfulProducts(insights);
        if (!rescue && helpers.length) blocks.push({ type: "products", title: ar ? "قد يفيد نبتتك حسب احتياجها" : "May help, based on its needs", items: helpers });
        if (rescue && (u.observation_note || u.symptoms.length)) {
          blocks.push({ type: "save_observation", plantId: plant.id, note: (u.observation_note ?? u.symptoms.join("، ")).slice(0, 300) });
        }
        break;
      }
      // Named species (not a saved plant)
      const sp = u.species_mentions.map((m) => resolveSpecies(m, deps.species)).find(Boolean) ?? (ctx.focus_species ? speciesBySlug.get(ctx.focus_species) ?? null : null);
      if (sp) {
        ctx.focus_species = sp.slug;
        speciesBlock(sp);
        facts.species = speciesKnowledge(sp, locale);
        blocks.push({ type: "checklist", title: rescue ? (ar ? "خطة فحص وإنقاذ آمنة" : "Safe check & rescue plan") : (ar ? "قائمة عناية" : "Care checklist"), items: rescue ? rescueChecklist(locale) : careChecklist(sp, locale), tone: rescue ? "rescue" : "care" });
        await recordExplored(sp, rescue ? (ar ? "سألت عن مشكلة فيها" : "Asked about a problem") : (ar ? "سألت عن العناية فيها" : "Asked about care"));
      } else {
        facts.species = null;
        facts.plant_unidentified = true;
        if (rescue) blocks.push({ type: "checklist", title: ar ? "خطة فحص آمنة" : "Safe check plan", items: rescueChecklist(locale), tone: "rescue" });
      }
      if (u.species_mentions.length && !sp) facts.unknown_species_mentioned = u.species_mentions;
      if (rescue) {
        facts.symptoms = u.symptoms;
        // Gentle product suggestion only when relevant to drainage/soil issues.
        const drainage = u.symptoms.join(" ").match(/صفر|yellow|تعفن|rot|ري|water/i);
        if (drainage) {
          const helpers = deps.products.filter((p) => ["cactus-succulent-mix-5l", "indoor-potting-mix-5l", "perlite-4l", "terracotta-pot-18"].includes(p.slug));
          facts.optional_products = helpers.map((h) => h.name_en);
          if (helpers.length) blocks.push({ type: "products", title: ar ? "قد تفيد إذا تأكد إن المشكلة من التصريف" : "Helpful if drainage turns out to be the issue", items: helpers.slice(0, 3).map((h) => productCard(h, locale)) });
        }
      }
      break;
    }

    case "get_my_plants": {
      if (!deps.user || !deps.data) { needAuth(); break; }
      if (!plants.length) { facts.user_plants = []; break; }
      const summaries = [];
      const cards: UserPlantCardData[] = [];
      for (const p of plants.slice(0, 12)) {
        const f = await plantFacts(p);
        summaries.push(f.fact);
        cards.push(userPlantCard(p, f.insights));
      }
      blocks.push({ type: "user_plants", title: ar ? "نباتاتك في مساحتك الخضراء" : "Plants in your Green Space", items: cards });
      facts.user_plants = summaries;
      facts.note = "Plant status is based only on the customer's records; you cannot see the plants.";
      break;
    }

    case "get_plant_history": {
      if (!deps.user || !deps.data) { needAuth(); break; }
      const { plant, ambiguous } = resolveUserPlant();
      if (ambiguous.length) { askWhichPlant(ambiguous); break; }
      if (!plant) { facts.plant_not_found = true; facts.user_plant_names = plants.map((p) => plantTitle(p, p.species_slug ? speciesBySlug.get(p.species_slug) ?? null : null, locale)); break; }
      ctx.focus_user_plant = plant.id;
      const activity = u.care_activity ?? "watering";
      const logs = await deps.data.getCareLogs(plant.id, { activity, limit: 5 });
      facts.plant = plantTitle(plant, plant.species_slug ? speciesBySlug.get(plant.species_slug) ?? null : null, locale);
      facts.activity = activity;
      facts.records = logs.map((l) => ({ date: l.occurred_at.slice(0, 10), notes: l.notes }));
      facts.no_records = logs.length === 0;
      blocks.push({ type: "user_plants", title: ar ? "نبتتك" : "Your plant", items: [userPlantCard(plant, (await loadInsights(plant)).insights)] });
      blocks.push({ type: "care_logs", title: ar ? `سجل ${DICTS.ar.plant.activity[activity]}` : `${DICTS.en.plant.activity[activity]} history`, plantId: plant.id, items: logs });
      break;
    }

    case "save_care_log": {
      if (!deps.user || !deps.data) { needAuth(); break; }
      const { plant, ambiguous } = resolveUserPlant();
      if (ambiguous.length) { askWhichPlant(ambiguous); break; }
      if (!plant) {
        facts.action = { status: "failed", reason: "plant_not_found" };
        blocks.push({ type: "action", status: "failed", message: ar ? "ما لقيت هذي النبتة في مساحتك الخضراء. أضفها أول أو اختر من نباتاتك." : "I couldn't find that plant in your Green Space. Add it first or pick one of your plants." });
        if (plants.length) blocks.push({ type: "user_plants", title: ar ? "نباتاتك" : "Your plants", items: plants.map((p) => userPlantCard(p)) });
        break;
      }
      const activity = u.care_activity ?? "watering";
      const days = u.activity_when === "yesterday" ? 1 : u.activity_when === "days_ago" ? u.activity_days_ago ?? 0 : 0;
      const when = new Date(now.getTime() - days * 86_400_000).toISOString();
      const ok = await deps.data.addCareLog(plant.id, activity, when, activity === "observation" ? u.observation_note : null);
      const title = plantTitle(plant, plant.species_slug ? speciesBySlug.get(plant.species_slug) ?? null : null, locale);
      ctx.focus_user_plant = plant.id;
      facts.action = { status: ok ? "success" : "failed", activity, plant: title, date: when.slice(0, 10) };
      blocks.push({
        type: "action", status: ok ? "success" : "failed",
        message: ok ? (ar ? `تم تسجيل ${DICTS.ar.plant.activity[activity]} لـ ${title} بتاريخ ${riyadhDate(new Date(when))}` : `Logged ${DICTS.en.plant.activity[activity].toLowerCase()} for ${title} on ${riyadhDate(new Date(when))}`)
          : (ar ? "ما قدرت أحفظ النشاط، حاول مرة ثانية." : "I couldn't save that activity. Please try again."),
      });
      if (ok) blocks.push({ type: "care_logs", title: ar ? "السجل المحدّث" : "Updated history", plantId: plant.id, items: await deps.data.getCareLogs(plant.id, { limit: 5 }) });
      break;
    }

    case "save_plant": {
      if (!deps.user || !deps.data) { needAuth(); break; }
      const sp = u.species_mentions.map((m) => resolveSpecies(m, deps.species)).find(Boolean) ?? (ctx.focus_species ? speciesBySlug.get(ctx.focus_species) ?? null : null);
      if (!sp) {
        facts.action = { status: "failed", reason: "species_unknown" };
        blocks.push({ type: "action", status: "failed", message: ar ? "ما قدرت أحدد نوع النبتة. تقدر تضيفها من صفحة «أضف نبتة» وتختار تعريف غير مؤكد." : "I couldn't identify the species. You can add it from “Add a plant” as an unconfirmed ID." });
        break;
      }
      const id = await deps.data.addUserPlant({ species_slug: sp.slug, nickname: u.plant_nickname });
      facts.action = { status: id ? "success" : "failed", plant: sp.name_en, nickname: u.plant_nickname };
      blocks.push({ type: "action", status: id ? "success" : "failed", message: id ? (ar ? `أضفت ${sp.name_ar}${u.plant_nickname ? ` (${u.plant_nickname})` : ""} لمساحتك الخضراء. تقدر تكمّل تفاصيل مكانها وإضاءتها من صفحتها.` : `Added ${sp.name_en}${u.plant_nickname ? ` (${u.plant_nickname})` : ""} to your Green Space. You can add its location and light on its page.`) : (ar ? "ما قدرت أحفظ النبتة." : "I couldn't save the plant.") });
      if (id) { ctx.focus_user_plant = id; touchedUserPlant = true; }
      break;
    }

    case "save_to_wishlist":
    case "add_to_cart": {
      const kind = u.intent === "add_to_cart" ? "cart" : "wishlist";
      // 1) Which plant: the resolved reference, else a name the customer typed, else the single obvious one.
      let target: RefItem | null = null;
      if (ref.kind === "ambiguous") { askWhichItem(ref.options); facts.action = { status: "needs_choice" }; break; }
      if (ref.kind === "missing") { referenceProblem(ref); facts.action = { status: "failed", reason: "reference_unresolved" }; }
      else if (ref.kind === "items") {
        if (ref.items.length > 1) { askWhichItem(ref.items); facts.action = { status: "needs_choice" }; break; }
        target = ref.items[0];
      } else {
        const named = itemsFromMentions();
        if (named.ambiguous) { askWhichItem(named.ambiguous); facts.action = { status: "needs_choice" }; break; }
        const set = activeSet(ctx);
        target = named.items[0]
          ?? (u.reference_index ? set?.items[u.reference_index - 1] ?? null : null)
          ?? (set?.items.length === 1 ? set.items[0] : null)
          ?? ctx.focus_item
          ?? (ctx.focus_species && speciesBySlug.get(ctx.focus_species) ? itemFromSpecies(speciesBySlug.get(ctx.focus_species)!) : null);
      }
      if (!target) {
        facts.action = { status: "failed", reason: "product_not_resolved" };
        blocks.push({ type: "action", status: "failed", message: ar ? "ما عرفت أي نبتة تقصد. اختر من البطاقات أو اكتب اسم النبتة." : "I'm not sure which plant you mean. Pick from the cards or name the plant." });
        break;
      }
      ctx.focus_item = target;
      // 2) The exact store product for that plant — never a different species.
      let prods = storeProductsFor(target, deps.products);
      if (prods.length > 1) {
        const msg = norm(input.message);
        const byVariant = prods.filter((p) => [p.variant_ar, p.variant_en].some((v) => v && msg.includes(norm(v))));
        if (byVariant.length === 1) prods = byVariant;
      }
      const tname = itemName(target, ar);
      if (!prods.length) {
        facts.action = { status: "failed", reason: "not_sold_in_al_nada", plant: tname };
        blocks.push({ type: "action", status: "failed", message: ar ? `${tname} غير متوفرة في متجر الندى، فما أقدر أضيفها.` : `${tname} isn't sold at AL NADA, so I can't add it.` });
        break;
      }
      if (prods.length > 1) {
        blocks.push({ type: "action", status: "needs_choice", message: ar ? `عندنا ${tname} بأكثر من خيار، أي واحد تبي؟` : `We have ${tname} in more than one option — which one?`, choices: prods.map((p) => ({ id: p.id, label: `${ar ? p.name_ar : p.name_en} — ${ar ? p.variant_ar : p.variant_en}` })) });
        facts.action = { status: "needs_choice", options: prods.map((p) => (ar ? p.variant_ar : p.variant_en)) };
        break;
      }
      const product = prods[0];
      const name = ar ? product.name_ar : product.name_en;
      // 3) The same request repeated right away (double send / retry) is not applied twice.
      const last = ctx.last_action;
      if (last && last.type === kind && last.item.product_id === product.id && last.turn === ctx.turn - 1 && sameRequest(last.message, input.message)) {
        facts.action = { status: "success", detail: "already done in the previous message; not repeated", product: name };
        blocks.push({ type: "action", status: "success", message: ar ? `${name} سبق وانضافت ✓ ما كررتها.` : `${name} was already added ✓ — not added twice.` });
        break;
      }
      let ok = false;
      if (kind === "cart") {
        if (product.stock < 1) {
          facts.action = { status: "failed", reason: "out_of_stock" };
          blocks.push({ type: "action", status: "failed", message: ar ? `${name} غير متوفرة حاليًا.` : `${name} is currently out of stock.` });
          break;
        }
        // The cart lives in the client (synced to the account); the UI performs this action and confirms.
        clientActions.push({ type: "add_to_cart", productId: product.id });
        facts.action = { status: "success", detail: "added to the customer's cart in the app", product: name };
        blocks.push({ type: "products", title: ar ? "المنتج" : "Product", items: [productCard(product, locale)] });
        ok = true;
      } else {
        if (!deps.user || !deps.data) { needAuth(); break; }
        ok = await deps.data.addToWishlist(product.id);
        facts.action = { status: ok ? "success" : "failed", product: name };
        blocks.push({ type: "action", status: ok ? "success" : "failed", message: ok ? (ar ? `حفظت ${name} في قائمة أمنياتك ✓` : `Saved ${name} to your wishlist ✓`) : (ar ? "ما قدرت أحفظها في قائمة الأمنيات." : "Couldn't save it to your wishlist.") });
        if (ok) blocks.push({ type: "products", title: ar ? "في قائمة أمنياتك" : "In your wishlist", items: [productCard(product, locale)] });
      }
      if (ok) ctx.last_action = { type: kind, item: itemFromProduct(product), message: input.message.slice(0, 200), turn: ctx.turn };
      break;
    }

    case "get_explored_history": {
      if (!deps.user || !deps.data) { needAuth(); break; }
      const rows = await deps.data.listExplored(u.time_range_days);
      facts.explored = rows.map((r) => ({ plant: (ar ? speciesBySlug.get(r.species_slug)?.name_ar : speciesBySlug.get(r.species_slug)?.name_en), reason: r.reason, date: r.last_explored_at.slice(0, 10) }));
      facts.no_records = rows.length === 0;
      facts.range_days = u.time_range_days;
      const items = rows
        .map((r) => deps.products.find((p) => (r.product_id ? p.id === r.product_id : p.species_slug === r.species_slug && p.kind === "plant")))
        .filter((p): p is ProductWithSpecies => !!p)
        .map((p) => productCard(p, locale));
      if (items.length) blocks.push({ type: "products", title: ar ? "نباتات استكشفتها" : "Plants you explored", items });
      break;
    }

    case "compare_plants": {
      let items: RefItem[] = [];
      if (ref.kind === "ambiguous") { askWhichItem(ref.options); break; }
      if (ref.kind === "missing") { referenceProblem(ref); break; }
      if (ref.kind === "items") items = ref.items;
      else {
        const named = itemsFromMentions();
        if (named.ambiguous) { askWhichItem(named.ambiguous); break; }
        items = named.items;
      }
      if (criterion) {
        // "أي وحدة أرخص؟ / الثانية تحتاج ري أقل؟" — answered from verified data among the plants on the table.
        const pool = ctx.compared.length >= 2 ? ctx.compared.map((k) => findItem(ctx, k)).filter((x): x is RefItem => !!x) : activeSet(ctx)?.items ?? [];
        const single = items.length === 1 ? items[0] : null;
        const candidates = (items.length >= 2 ? items : single ? [single, ...pool.filter((x) => x.key !== single.key)] : pool).slice(0, 4);
        if (candidates.length < 2) { facts.reference_problem = "There is nothing to compare it with yet."; break; }
        const ans = answerCriterion(criterion, candidates, deps.products, deps.species, ar, !asksForMore(input.message));
        const winner = ans.winner ? candidates.find((c) => c.key === ans.winner) ?? null : null;
        facts.answer = { criterion, computed_from: criterion === "price" ? "AL NADA store prices" : "verified species data", rows: ans.rows, winner: winner ? itemName(winner, ar) : null, result: ans.reason, asked_about: single ? itemName(single, ar) : null };
        facts.compare = candidates.map(refFact);
        ctx.compared = candidates.map((c) => c.key);
        // "الثانية أرخص؟" keeps the second in focus; "أي وحدة أرخص؟" focuses the answer (none on a tie).
        ctx.focus_item = single ?? winner;
        if (criterion === "price") for (const c of candidates) if (!storeProductsFor(c, deps.products).length) unavailableNotice(c);
        break;
      }
      const unique = items.slice(0, 3);
      if (!unique.length) { facts.reference_problem = "No plants to compare were identified."; break; }
      facts.compare = unique.map(refFact);
      facts.compare_scope = "Compare exactly these plants, in this order. Do not add any other plant unless the customer asks for alternatives.";
      if (Object.keys(ctx.preferences).length) facts.customer_conditions = ctx.preferences;
      ctx.compared = unique.length >= 2 ? unique.map((i) => i.key) : ctx.compared;
      ctx.focus_item = unique.length === 1 ? unique[0] : null;
      for (const i of unique) {
        showItem(i, false);
        const sp = speciesOf(i);
        if (sp) await recordExplored(sp, ar ? "قارنتها مع نبتة ثانية" : "Compared with another plant");
      }
      break;
    }

    case "general_question": {
      const sp = u.species_mentions.map((m) => resolveSpecies(m, deps.species)).find(Boolean);
      if (sp) { facts.species = speciesKnowledge(sp, locale); speciesBlock(sp); await recordExplored(sp, ar ? "سألت عنها" : "Asked about it"); }
      break;
    }

    default:
      intent = "clarify_request";
      facts.clarify = true;
  }

  if (personal && touchedUserPlant && facts.user_plant) {
    const p = plants.find((x) => x.id === ctx.focus_user_plant);
    const sp = p?.species_slug ? speciesBySlug.get(p.species_slug) ?? null : null;
    facts.recognized_saved_plant = { nickname: p?.nickname, species: sp ? (ar ? sp.name_ar : sp.name_en) : p?.unconfirmed_label ?? null, scientific: sp?.scientific_name ?? null, note: "The customer means THIS saved plant from their Green Space. Answer about it; never suggest a different species." };
  }
  // Remember which kind of plant this turn was about, for pronoun follow-ups next turn.
  if (touchedUserPlant) ctx.last_focus = "user_plant";
  else if (ctx.focus_item && ctx.focus_item.key !== focusItemBefore) ctx.last_focus = "item";
  else if (storeSet || discuss) ctx.last_focus = "item";

  // 3) Response generation grounded in FACTS. If this second call fails after real work was done
  // (e.g. a care log was saved), return the factual blocks with replyError instead of hiding it.
  const generate = () => deps.llm(
    [
      { role: "system", content: ar ? RESPOND_SYSTEM : RESPOND_SYSTEM_EN },
      { role: "system", content: ar ? "لغة الرد: العربية باللهجة السعودية." : "Reply language: English only." },
      { role: "system", content: `FACTS (authoritative, from AL NADA's database and botanical cache):\n${JSON.stringify(facts)}` },
      ...history.slice(-6).map((h) => ({ role: h.role, content: h.content }) as LlamaMessage),
      { role: "user", content: input.message },
    ],
    { temperature: 0.4, maxTokens: 700 },
  );
  // Server-authored truth about actions: the model must restate it and may never contradict it.
  const actionBlock = blocks.find((b): b is Extract<ChatBlock, { type: "action" }> => b.type === "action" && (b.status === "success" || b.status === "failed"));
  const confirmation = clientActions.length ? (ar ? "أضفتها لسلتك ✓" : "Added to your cart ✓") : actionBlock?.message ?? null;
  const succeeded = clientActions.length > 0 || actionBlock?.status === "success";
  if (confirmation) facts.must_state = confirmation;
  // A reply is unusable if it contradicts the real outcome or echoes internal context (FACTS/JSON).
  const leaks = (text: string) => /FACTS|authoritative|"intent"\s*:|\{\s*"/.test(text);
  const contradicts = (text: string) =>
    leaks(text) || (confirmation !== null && (succeeded ? FAILURE_WORDS.test(text) : SUCCESS_WORDS.test(text) && !FAILURE_WORDS.test(text)));

  let reply: string;
  try {
    reply = (await generate()).trim();
    if (contradicts(reply)) {
      const retry = (await generate()).trim();
      if (!contradicts(retry)) reply = retry;
      else if (confirmation) reply = confirmation;
      else return { reply: "", replyError: true, blocks, context: ctx, sessionId: input.sessionId, intent, clientActions, model: deps.model };
    }
    // Llama occasionally emits stray CJK/Cyrillic/Vietnamese glyphs inside Arabic: retry once, then strip.
    if (hasStrayScript(reply, locale)) {
      const retry = (await generate()).trim();
      reply = hasStrayScript(retry, locale) ? stripStray(retry, locale) : retry;
    }
  } catch (e) {
    if (!blocks.length) throw e;
    return { reply: "", replyError: true, blocks, context: ctx, sessionId: input.sessionId, intent, clientActions, model: deps.model };
  }

  // A list of plants in Nada's own reply becomes the new active group, so "الأولى/الثانية" next turn
  // means exactly what the customer just read. Not on turns that refer to existing plants (a comparison
  // or "the second one" must never reorder or replace the group).
  const REPLY_LIST_INTENTS: Intent[] = ["general_question", "recommend_plant", "cheaper_options", "clarify_request", "get_plant_care"];
  if (!storeSet && ref.kind === "none" && !discuss && REPLY_LIST_INTENTS.includes(intent)) {
    const listed = extractReplyList(reply, deps.species, intent === "recommend_plant" || asksForRecommendations(input.message));
    if (listed.length >= 2) { pushRecSet(ctx, "reply", listed); if (!touchedUserPlant) ctx.last_focus = "item"; }
  }

  const debug = process.env.NODE_ENV === "development" ? { understanding: u, facts } : undefined;
  return { reply, blocks, context: ctx, sessionId: input.sessionId, intent, clientActions, model: deps.model, debug };
}

/** Pulls the first JSON object out of a completion (models may wrap it in prose or ```json fences). */
export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

const CARE_DONE = /(^|[^\p{L}])(سقيت|سقيتها|سقيته|رويت|سمدت|سمّدت|سمدتها|قصيت|قلمت|قلّمت|نظفت|نظّفت|مسحت|غيرت|غيّرت|بدلت|نقلت|زرعت)(?=$|[^\p{L}])|\b(watered|fertili[sz]ed|fed|repotted|pruned|trimmed|cleaned|wiped|misted)\b/u;

const SYMPTOMS = /صفرا|صفراء|اصفر|ذبل|ذابل|تذبل|بنية|تعفن|عفن|حشرات|تساقط|تطيح|تموت|ميتة|تعبان|بقع|yellow|wilt|droop|brown|\brot(s|ting|ten)?\b|mold|mould|pests?\b|bugs\b|spots|dying|dropping/i;
const FAILURE_WORDS = /لم أستطع|لم استطع|ما قدرت|ما قدرنا|لم يتم|لم تكتمل|فشل|تعذر|couldn['’]t|could not|failed|unable/i;
const SUCCESS_WORDS = /تم |حفظت|أضفت|سجلت|سجّلت|saved|added|logged/i;

// Allowlist: Arabic replies may contain Arabic-script letters and plain A–Z (scientific names);
// English replies Latin + Arabic. Any other letter (CJK, kana, Cyrillic, Vietnamese…) is a model glitch.
const STRAY_AR = /(?![\p{Script=Arabic}A-Za-z])\p{L}/u;
const STRAY_EN = /(?![\p{Script=Latin}\p{Script=Arabic}])\p{L}/u;
export const hasStrayScript = (text: string, locale: Locale) => (locale === "ar" ? STRAY_AR : STRAY_EN).test(text);
const stripStray = (text: string, locale: Locale) =>
  text.replace(new RegExp((locale === "ar" ? STRAY_AR : STRAY_EN).source, "gu"), "").replace(/\s{2,}/g, " ");

/**
 * Deterministic backstop for constraints that affect safety or suitability, so they never depend
 * solely on the model noticing them. Only fills values the model left empty.
 */
export function detectHardPreferences(message: string, fromModel: Partial<Preferences>): Partial<Preferences> {
  const m = message.toLowerCase();
  const out: Partial<Preferences> = {};
  const pets = new Set(fromModel.pets ?? []);
  // Unicode-aware boundaries: \b does not work for Arabic letters.
  if (/(^|[^\p{L}])(قطة|قطه|قطط|قطتي|قطو|بس|بسة|بسه)(?=$|[^\p{L}])|(^|[^\p{L}])cats?(?=$|[^\p{L}])|kitten/u.test(m)) pets.add("cat");
  if (/كلب|كلاب|\bdogs?\b|puppy/.test(m)) pets.add("dog");
  if (pets.size && pets.size !== (fromModel.pets?.length ?? 0)) out.pets = [...pets];
  // Explicit afternoon sun always wins (the model sometimes returns false for "الشمس تضربها العصر").
  if (/العصر|عصرا|الغروب|afternoon|west[- ]facing|غربي/.test(m) && /شمس|sun/.test(m) && fromModel.afternoon_sun !== true) out.afternoon_sun = true;
  if (!fromModel.placement && /بلكون|بلكونة|شرفة|balcony|terrace|تراس/.test(m)) out.placement = "balcony";
  if (!fromModel.light && /(اضاءة|إضاءة|ضوء|نور)\S*\s*(ضعيف|خفيف|قليل)|ضعيفة الاضاءة|low light|dim|dark room/.test(m)) out.light = "low";
  return out;
}

function stripNulls<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))) as Partial<T>;
}
