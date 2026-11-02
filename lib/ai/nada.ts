// Nada AI orchestration:
// message → Llama intent understanding → Zod validation → authorised data retrieval
// → botanical knowledge + deterministic recommendation/care logic → Llama response → rich UI blocks.
//
// Dependencies (model + user-scoped data access) are injected so the pipeline is testable and the
// model can never reach the database: it only fills the Understanding schema.

import { matchesQuery } from "@/lib/catalog/filter";
import type { Locale } from "@/lib/i18n/dict";
import { DICTS } from "@/lib/i18n/dict";
import type { ProductWithSpecies, Species } from "@/lib/plants/types";
import { PreferencesSchema, recommend, type Preferences } from "@/lib/recommendations/engine";
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
  type Understanding,
  type UserPlantCardData,
} from "./schemas";

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
const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[ً-ٰٟ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/^ال/, "").trim();

// Common Saudi/Arabic and English names that differ from catalogue names.
const ALIASES: Record<string, string> = {
  "سانسفيريا": "dracaena-trifasciata", "سنسيفيريا": "dracaena-trifasciata", "جلد النمر": "dracaena-trifasciata", "snake plant": "dracaena-trifasciata",
  "بوتس": "epipremnum-aureum", "بوثوس": "epipremnum-aureum", "pothos": "epipremnum-aureum",
  "زاميا": "zamioculcas-zamiifolia", "zz": "zamioculcas-zamiifolia",
  "صبار": "aloe-vera", "الوفيرا": "aloe-vera", "صبار الالوفيرا": "aloe-vera",
  "فل": "jasminum-sambac", "ياسمين": "jasminum-sambac", "jasmine": "jasminum-sambac",
  "نعناع": "mentha-spicata", "mint": "mentha-spicata", "ريحان": "ocimum-basilicum", "basil": "ocimum-basilicum",
  "جهنميه": "bougainvillea-glabra", "مجنونه": "bougainvillea-glabra", "دفله": "nerium-oleander",
  "مطاطي": "ficus-elastica", "فيكس": "ficus-elastica", "اوركيد": "phalaenopsis-hybrid", "orchid": "phalaenopsis-hybrid",
  "كالاثيا": "goeppertia-orbifolia", "calathea": "goeppertia-orbifolia", "زنبق السلام": "spathiphyllum-wallisii", "سباثيفيلوم": "spathiphyllum-wallisii",
  "monstera": "monstera-deliciosa", "مونستيرا": "monstera-deliciosa", "مونستيره": "monstera-deliciosa",
  "عصفور الجنه": "strelitzia-reginae", "لافندر": "lavandula-angustifolia", "خزامي": "lavandula-angustifolia", "اكليل الجبل": "salvia-rosmarinus", "روزماري": "salvia-rosmarinus",
};

export function resolveSpecies(mention: string, species: Species[]): Species | null {
  const m = norm(mention);
  if (!m) return null;
  // whole-word alias match ("zz" must not match inside "xyzzy")
  const alias = Object.entries(ALIASES).find(([k]) => ` ${m} `.includes(` ${norm(k)} `));
  if (alias) return species.find((s) => s.slug === alias[1]) ?? null;
  let best: { s: Species; score: number } | null = null;
  for (const s of species) {
    const names = [s.name_ar, s.name_en, s.scientific_name, s.slug.replace(/-/g, " ")].map(norm);
    let score = 0;
    for (const n of names) {
      if (n === m) score = Math.max(score, 3);
      else if (n.includes(m) && m.length >= 3) score = Math.max(score, 2);
      else if (m.includes(n) && n.length >= 3) score = Math.max(score, 1.5);
      else if (n.split(/[\s()]+/).some((w) => w.length >= 4 && m.includes(w))) score = Math.max(score, 1);
    }
    if (score > (best?.score ?? 0)) best = { s, score };
  }
  return best?.s ?? null;
}

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
  const history = input.history.slice(-8);
  const speciesBySlug = new Map(deps.species.map((s) => [s.slug, s]));

  // 1) Understanding (Llama → JSON → Zod). One retry on invalid output.
  const plants = deps.user && deps.data ? await deps.data.listUserPlants() : [];
  const understandMsgs: LlamaMessage[] = [
    { role: "system", content: UNDERSTAND_SYSTEM },
    {
      role: "system",
      content: `Context: workflow=${ctx.workflow}; signed_in=${Boolean(deps.user)}; user_saved_plant_nicknames=${JSON.stringify(plants.map((p) => p.nickname).filter(Boolean))}; previous_preferences=${JSON.stringify(ctx.preferences)}; last_recommended_count=${ctx.last_recommended.length}`,
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
  // Ordinal references ("الثانية", "the first") pick an exact product — never left to the model alone.
  if ((u.intent === "save_to_wishlist" || u.intent === "add_to_cart") && ctx.last_recommended.length) {
    const idx = detectOrdinal(input.message);
    if (idx) u = { ...u, reference_index: idx };
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
  const resolveUserPlant = (): { plant: UserPlantRecord | null; ambiguous: UserPlantRecord[] } => {
    if (selectedPlant) return { plant: selectedPlant, ambiguous: [] };
    if (u!.plant_nickname) {
      const n = norm(u!.plant_nickname);
      const hits = plants.filter((p) => p.nickname && norm(p.nickname) === n);
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
      if (p && !u!.species_mentions.length && !u!.plant_nickname) return { plant: p, ambiguous: [] };
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

  const plantFacts = async (p: UserPlantRecord) => {
    const sp = p.species_slug ? speciesBySlug.get(p.species_slug) ?? null : null;
    const logs = deps.data ? await deps.data.getCareLogs(p.id, { limit: 8 }) : [];
    return {
      sp,
      logs,
      fact: {
        nickname: p.nickname, species: sp ? speciesKnowledge(sp, locale) : { unconfirmed_description: p.unconfirmed_label },
        location: p.location, light_condition: p.light_condition, watering_preference: p.watering_preference,
        source: p.source, added: p.created_at.slice(0, 10), last_watered: p.last_watered_at?.slice(0, 10) ?? null,
        recent_care_logs: logs.map((l) => ({ activity: l.activity, date: l.occurred_at.slice(0, 10), notes: l.notes })),
      },
    };
  };

  const userPlantCard = (p: UserPlantRecord): UserPlantCardData => {
    const sp = p.species_slug ? speciesBySlug.get(p.species_slug) ?? null : null;
    return {
      id: p.id, title: plantTitle(p, sp, locale), species: sp?.scientific_name ?? (ar ? "تعريف غير مؤكد" : "Unconfirmed ID"),
      image: sp?.image?.thumb_url ?? null, location: p.location, light: p.light_condition ? DICTS[locale].attr.light[p.light_condition as "low"] ?? p.light_condition : null,
      lastWatered: p.last_watered_at, source: p.source,
    };
  };

  const recordExplored = async (sp: Species, reason: string, productId: string | null = null) => {
    if (deps.data && ctx.save_explored) await deps.data.upsertExplored({ species_slug: sp.slug, product_id: productId, reason }).catch(() => {});
  };

  const speciesBlock = (sp: Species) => {
    const product = deps.products.find((p) => p.species_slug === sp.slug && p.kind === "plant") ?? null;
    blocks.push({ type: "species", item: { slug: sp.slug, name: ar ? sp.name_ar : sp.name_en, scientific: sp.scientific_name, image: sp.image?.thumb_url ?? null, facts: speciesFacts(sp, locale), productSlug: product?.slug ?? null } });
  };

  // 2) Authorised retrieval + deterministic logic per intent.
  switch (u.intent) {
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
        ctx.last_recommended = items.map((i) => i.id);
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
        const { sp, logs, fact } = await plantFacts(plant);
        facts.user_plant = fact;
        blocks.push({ type: "user_plants", title: ar ? "نبتتك" : "Your plant", items: [userPlantCard(plant)] });
        if (logs.length) blocks.push({ type: "care_logs", title: ar ? "آخر نشاط مسجل" : "Recent recorded activity", plantId: plant.id, items: logs.slice(0, 5) });
        if (sp) ctx.focus_species = sp.slug;
        blocks.push({ type: "checklist", title: rescue ? (ar ? "خطة فحص وإنقاذ آمنة" : "Safe check & rescue plan") : (ar ? "قائمة عناية" : "Care checklist"), items: rescue ? rescueChecklist(locale) : sp ? careChecklist(sp, locale) : rescueChecklist(locale), tone: rescue ? "rescue" : "care" });
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
      blocks.push({ type: "user_plants", title: ar ? "نباتاتك في مساحتك الخضراء" : "Plants in your Green Space", items: plants.map(userPlantCard) });
      const summaries = [];
      for (const p of plants.slice(0, 8)) summaries.push((await plantFacts(p)).fact);
      facts.user_plants = summaries;
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
      blocks.push({ type: "user_plants", title: ar ? "نبتتك" : "Your plant", items: [userPlantCard(plant)] });
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
        if (plants.length) blocks.push({ type: "user_plants", title: ar ? "نباتاتك" : "Your plants", items: plants.map(userPlantCard) });
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
      if (id) ctx.focus_user_plant = id;
      break;
    }

    case "save_to_wishlist":
    case "add_to_cart": {
      const product = resolveReferencedProduct(u, ctx, deps);
      if (!product) {
        facts.action = { status: "failed", reason: "product_not_resolved" };
        blocks.push({ type: "action", status: "failed", message: ar ? "ما عرفت أي منتج تقصد. اختر من البطاقات أو اكتب اسم النبتة." : "I'm not sure which product you mean. Pick from the cards or name the plant." });
        break;
      }
      const name = ar ? product.name_ar : product.name_en;
      if (u.intent === "add_to_cart") {
        if (product.stock < 1) {
          facts.action = { status: "failed", reason: "out_of_stock" };
          blocks.push({ type: "action", status: "failed", message: ar ? `${name} غير متوفرة حاليًا.` : `${name} is currently out of stock.` });
          break;
        }
        // The cart lives in the client (synced to the account); the UI performs this action and confirms.
        clientActions.push({ type: "add_to_cart", productId: product.id });
        facts.action = { status: "success", detail: "added to the customer's cart in the app", product: ar ? product.name_ar : product.name_en };
        blocks.push({ type: "products", title: ar ? "المنتج" : "Product", items: [productCard(product, locale)] });
      } else {
        if (!deps.user || !deps.data) { needAuth(); break; }
        const ok = await deps.data.addToWishlist(product.id);
        facts.action = { status: ok ? "success" : "failed", product: product.name_en };
        blocks.push({ type: "action", status: ok ? "success" : "failed", message: ok ? (ar ? `حفظت ${name} في قائمة أمنياتك ✓` : `Saved ${name} to your wishlist ✓`) : (ar ? "ما قدرت أحفظها في قائمة الأمنيات." : "Couldn't save it to your wishlist.") });
        if (ok) blocks.push({ type: "products", title: ar ? "في قائمة أمنياتك" : "In your wishlist", items: [productCard(product, locale)] });
      }
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
      const sps = u.species_mentions.map((m) => resolveSpecies(m, deps.species)).filter((s): s is Species => !!s);
      const unique = [...new Map(sps.map((s) => [s.slug, s])).values()].slice(0, 3);
      facts.compare = unique.map((x) => speciesKnowledge(x, locale));
      for (const s of unique) { speciesBlock(s); await recordExplored(s, ar ? "قارنتها مع نبتة ثانية" : "Compared with another plant"); }
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
    if (STRAY_SCRIPT.test(reply)) {
      const retry = (await generate()).trim();
      reply = STRAY_SCRIPT.test(retry) ? retry.replace(STRAY_SCRIPT_G, "").replace(/\s{2,}/g, " ") : retry;
    }
  } catch (e) {
    if (!blocks.length) throw e;
    return { reply: "", replyError: true, blocks, context: ctx, sessionId: input.sessionId, intent, clientActions, model: deps.model };
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

export function detectOrdinal(message: string): number | null {
  const m = message.toLowerCase();
  if (/(الاولى|الأولى|الاول|الأول|اول وحده|أول وحدة|\bfirst\b|\b1st\b)/.test(m)) return 1;
  if (/(الثانية|الثانيه|الثاني|ثاني وحده|ثاني وحدة|\bsecond\b|\b2nd\b)/.test(m)) return 2;
  if (/(الثالثة|الثالثه|الثالث|ثالث وحده|\bthird\b|\b3rd\b)/.test(m)) return 3;
  return null;
}

const SYMPTOMS = /صفرا|صفراء|اصفر|ذبل|ذابل|تذبل|بنية|تعفن|عفن|حشرات|تساقط|تطيح|تموت|ميتة|تعبان|بقع|yellow|wilt|droop|brown|\brot(s|ting|ten)?\b|mold|mould|pests?\b|bugs\b|spots|dying|dropping/i;
const FAILURE_WORDS = /لم أستطع|لم استطع|ما قدرت|ما قدرنا|لم يتم|لم تكتمل|فشل|تعذر|couldn['’]t|could not|failed|unable/i;
const SUCCESS_WORDS = /تم |حفظت|أضفت|سجلت|سجّلت|saved|added|logged/i;

const STRAY = "\\u0400-\\u04FF\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uAC00-\\uD7AF\\u1EA0-\\u1EF9";
const STRAY_SCRIPT = new RegExp(`[${STRAY}]`);
const STRAY_SCRIPT_G = new RegExp(`[${STRAY}]`, "g");

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

/** "the second plant" → last_recommended[1]; otherwise a named product; otherwise the single focus. */
function resolveReferencedProduct(u: Understanding, ctx: ChatContext, deps: NadaDeps): ProductWithSpecies | null {
  if (u.reference_index && ctx.last_recommended[u.reference_index - 1]) {
    return deps.products.find((p) => p.id === ctx.last_recommended[u.reference_index! - 1]) ?? null;
  }
  for (const m of u.species_mentions) {
    const recent = deps.products.filter((p) => ctx.last_recommended.includes(p.id));
    const inRecent = recent.find((p) => matchesQuery(p, m));
    if (inRecent) return inRecent;
    const sp = resolveSpecies(m, deps.species);
    if (sp) return deps.products.find((p) => p.species_slug === sp.slug && p.kind === "plant") ?? null;
  }
  if (ctx.last_recommended.length === 1) return deps.products.find((p) => p.id === ctx.last_recommended[0]) ?? null;
  if (ctx.focus_species) return deps.products.find((p) => p.species_slug === ctx.focus_species && p.kind === "plant") ?? null;
  return null;
}
