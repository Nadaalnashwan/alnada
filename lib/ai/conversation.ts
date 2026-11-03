// Conversation reference memory for Nada AI.
//
// Every group of plants Nada presents (store picks or a list in her reply) is stored as an ordered
// recommendation set. "الأولى / الثانية / آخر وحدة / قارني بينهم / هذي / أضيفيها" are resolved here,
// deterministically, against the LATEST group (or an explicitly named older one) — never left to the
// model reading raw history, and never silently swapped for a different plant.

import type { ProductWithSpecies, Species } from "@/lib/plants/types";
import { MAX_REC_SETS, type ChatContext, type RecSet, type RefItem } from "./schemas";
import { matchSpecies, norm, words } from "./species-match";

// ───────────────────────── items ─────────────────────────
export function itemFromProduct(p: ProductWithSpecies): RefItem {
  return { key: p.id, name_ar: p.name_ar, name_en: p.name_en, scientific: p.species?.scientific_name ?? null, species_slug: p.species_slug, product_id: p.id };
}
export function itemFromSpecies(s: Species): RefItem {
  return { key: `sp:${s.slug}`, name_ar: s.name_ar, name_en: s.name_en, scientific: s.scientific_name, species_slug: s.slug, product_id: null };
}
export const itemName = (i: RefItem, ar: boolean) => (ar ? i.name_ar : i.name_en) || i.name_ar || i.name_en;

/** Adds a new group, makes it the active one and resets per-group focus. Keeps older groups for explicit references. */
export function pushRecSet(ctx: ChatContext, source: RecSet["source"], items: RefItem[]) {
  const unique = [...new Map(items.map((i) => [i.key, i])).values()].slice(0, 6);
  if (!unique.length) return;
  const set: RecSet = { id: ctx.turn, source, items: unique };
  ctx.rec_sets = [...ctx.rec_sets.filter((s) => s.id !== set.id), set].slice(-MAX_REC_SETS);
  ctx.active_set = set.id;
  ctx.focus_item = null;
  ctx.compared = [];
  ctx.last_recommended = unique.map((i) => i.product_id).filter((x): x is string => !!x);
}

export const activeSet = (ctx: ChatContext) => ctx.rec_sets.find((s) => s.id === ctx.active_set) ?? ctx.rec_sets.at(-1) ?? null;

// ───────────────────────── catalogue validation ─────────────────────────
/** The exact catalogue product behind an item, only if its species/scientific name still agree. */
export function validatedProduct(item: RefItem, products: ProductWithSpecies[]): ProductWithSpecies | null {
  if (!item.product_id) return null;
  const p = products.find((x) => x.id === item.product_id && x.is_active !== false);
  if (!p) return null;
  if (item.species_slug && p.species_slug !== item.species_slug) return null;
  if (item.scientific && p.species && norm(p.species.scientific_name) !== norm(item.scientific)) return null;
  return p;
}

/** Store products that are this exact plant: the validated product, else plant products of the same verified species. */
export function storeProductsFor(item: RefItem, products: ProductWithSpecies[]): ProductWithSpecies[] {
  const exact = validatedProduct(item, products);
  if (exact) return [exact];
  if (!item.species_slug) return [];
  return products.filter((p) => p.species_slug === item.species_slug && p.kind === "plant" && p.is_active !== false);
}

// ───────────────────────── reference resolution ─────────────────────────
export type Resolution =
  | { kind: "none" }
  | { kind: "items"; items: RefItem[]; via: "ordinal" | "named" | "all" | "focus" | "last_action"; setId: number | null }
  | { kind: "ambiguous"; options: RefItem[] }
  | { kind: "missing"; reason: "no_group" | "out_of_range" | "no_focus" };

// Text is matched after normalisation (أ/إ/آ→ا, ة→ه, ى→ي).
const t = (s: string) => ` ${s.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[ً-ٰٟ]/g, "").replace(/[؟?!.,،:;()«»"]/g, " ").replace(/\s+/g, " ").trim()} `;

const GROUP_FIRST = / (الاقتراحات|الخيارات|المجموعه|النباتات|اقتراحاتك) (الاولي|الاول|الاوليه) | (اول|اولي) (اقتراحات|خيارات|مجموعه|نباتات|اقتراح)| first (set|group|suggestions|options|batch|recommendations) /;
const GROUP_PREVIOUS = / (الاقتراحات|الخيارات|المجموعه|النباتات|اقتراحاتك|اللي) (السابقه|القديمه|اللي قبل|قبل) | الخيارات السابقه | الاقتراحات السابقه | (previous|earlier|older) (set|group|suggestions|options|recommendations|ones) /;
// Arabic words may carry a joined prefix: و/ف/ب/ل ("والثانية", "بالأولى", "للثانية").
const P = "(?:و|ف|ب|ل|وب|ول)?";
const wordRe = (alts: string) => new RegExp(` ${P}(${alts}) `);
const ORDINALS: [RegExp, number][] = [
  [wordRe("الاولي|الاول|لاولي|الخيار الاول|الاقتراح الاول|اول وحده|اول نبته|اول خيار|first one|the first|first|1st|number one|رقم 1|رقم ١"), 1],
  [wordRe("الثانيه|الثاني|لثانيه|الخيار الثاني|الاقتراح الثاني|ثاني وحده|ثاني نبته|ثاني خيار|second one|the second|second|2nd|number two|رقم 2|رقم ٢"), 2],
  [wordRe("الثالثه|الثالث|لثالثه|الخيار الثالث|ثالث وحده|ثالث نبته|third one|the third|third|3rd|رقم 3|رقم ٣"), 3],
  [wordRe("الرابعه|الرابع|لرابعه|fourth|4th"), 4],
];
const LAST_ONE = wordRe("اخر وحده|الاخيره|الاخير|لاخيره|اخر نبته|اخر خيار|the last one|last one|the last");
const LAST_TWO = wordRe("اخر نبتتين|اخر ثنتين|اخر اثنين|اخر 2|the last two|last two");
const ALL = / (?:و)?(بينهم|بينها|الاثنين|الثنتين|كلهم|كلها|الكل|both|all of them|them all|between them|compare them) /;
const LAST_ACTION = / (وش|ايش|شو|what) (اضفتي|اضفت|حفظتي|حفظت|did you add|did you save|have you added) /;
const FOCUS = / (هذي|هذه|ذي|ذيك|هاذي|هاذيك|هذا|ذا|ذاك|هي|this one|that one|this plant|that plant|it|اللي قلتي عنها|اللي تكلمنا عنها|اللي قلتي عنه|اللي اخترتيها|اللي اخترتها|اللي اخترتيه) |\S+(يها|يه|ها) (للسله|للمفضله|بالمفضله|في المفضله|لقائمه|بقائمه|للقائمه)| (ضيفيها|اضيفيها|احفظيها|حطيها|خليها|اشتريها|add it|save it|buy it) /;
const COMPARE = / (قارني|قارن|قارنيلي|مقارنه|الفرق بين|وش الفرق|ايش الفرق|compare|difference between|vs|versus) /;

export const detectOrdinals = (message: string): number[] => {
  const m = t(message);
  return ORDINALS.filter(([re]) => re.test(m)).map(([, n]) => n);
};

/** The group a message refers to: an explicitly older one ("الخيارات السابقة", "first suggestions") or the active one. */
function targetSet(m: string, ctx: ChatContext): RecSet | null {
  if (!ctx.rec_sets.length) return null;
  if (GROUP_FIRST.test(m)) return ctx.rec_sets[0];
  if (GROUP_PREVIOUS.test(m)) {
    const idx = ctx.rec_sets.findIndex((s) => s.id === activeSet(ctx)?.id);
    return ctx.rec_sets[Math.max(0, (idx < 0 ? ctx.rec_sets.length : idx) - 1)];
  }
  return activeSet(ctx);
}

/** Plants from any recent group that the user names explicitly ("أضيفي البوتس"), latest group first. */
function namedItems(message: string, ctx: ChatContext): RefItem[] {
  const msg = ` ${words(message).join(" ")} `;
  const hits: RefItem[] = [];
  for (const set of [...ctx.rec_sets].reverse()) {
    for (const i of set.items) {
      const names = [i.name_ar, i.name_en, i.scientific ?? ""].flatMap((n) => [n, n.replace(/\([^)]*\)/g, ""), n.match(/\(([^)]+)\)/)?.[1] ?? ""]).map((n) => words(n).join(" ")).filter((n) => n.length >= 3);
      if (names.some((n) => msg.includes(` ${n} `)) && !hits.some((h) => h.key === i.key)) hits.push(i);
    }
  }
  return hits;
}

export function resolveReference(message: string, ctx: ChatContext): Resolution {
  const m = t(message);
  const set = targetSet(m, ctx);
  const groupNamed = GROUP_FIRST.test(m) || GROUP_PREVIOUS.test(m);
  // Strip the group phrase so "أول اقتراحات" is not read as the ordinal "first item".
  const body = groupNamed ? m.replace(GROUP_FIRST, " ").replace(GROUP_PREVIOUS, " ") : m;

  const ordinals = detectOrdinals(body);
  if (ordinals.length) {
    if (!set) return { kind: "missing", reason: "no_group" };
    const items = ordinals.map((n) => set.items[n - 1]).filter((x): x is RefItem => !!x);
    if (items.length !== ordinals.length) return { kind: "missing", reason: "out_of_range" };
    return { kind: "items", items, via: "ordinal", setId: set.id };
  }
  if (LAST_TWO.test(body) && set) return { kind: "items", items: set.items.slice(-2), via: "ordinal", setId: set.id };
  if (LAST_ONE.test(body) && set) return { kind: "items", items: [set.items.at(-1)!], via: "ordinal", setId: set.id };

  const named = namedItems(message, ctx);
  if (named.length) return { kind: "items", items: named, via: "named", setId: null };

  if (groupNamed && set) return { kind: "items", items: set.items, via: "all", setId: set.id };
  if (ALL.test(body)) {
    const compared = ctx.compared.map((k) => findItem(ctx, k)).filter((x): x is RefItem => !!x);
    if (compared.length >= 2 && !groupNamed) return { kind: "items", items: compared, via: "all", setId: null };
    if (set) return { kind: "items", items: set.items.slice(0, 3), via: "all", setId: set.id };
    return { kind: "missing", reason: "no_group" };
  }
  if (LAST_ACTION.test(m)) return ctx.last_action ? { kind: "items", items: [ctx.last_action.item], via: "last_action", setId: null } : { kind: "missing", reason: "no_focus" };
  if (FOCUS.test(m)) {
    if (ctx.focus_item) return { kind: "items", items: [ctx.focus_item], via: "focus", setId: null };
    if (set?.items.length === 1) return { kind: "items", items: set.items, via: "focus", setId: set.id };
    if (set) return { kind: "ambiguous", options: set.items };
    return { kind: "missing", reason: "no_focus" };
  }
  return { kind: "none" };
}

export const isCompareRequest = (message: string) => COMPARE.test(t(message));

export function findItem(ctx: ChatContext, key: string): RefItem | null {
  if (ctx.focus_item?.key === key) return ctx.focus_item;
  for (const s of [...ctx.rec_sets].reverse()) for (const i of s.items) if (i.key === key) return i;
  return ctx.last_action?.item.key === key ? ctx.last_action.item : null;
}

// ───────────────────────── "which one is cheaper / needs less water?" ─────────────────────────
export type Criterion = "price" | "water" | "easy" | "heat" | "pets";
const CRITERIA: [Criterion, RegExp][] = [
  ["price", / (ارخص|اغلي|السعر|سعرها|cheaper|cheapest|more expensive|pricier) /],
  ["water", /(ري|سقي|مويه|ماء|موي) (اقل|اكثر)|(اقل|اكثر) (ري|سقي|مويه|ماء)|less water|least water|more water|water less|less watering/],
  ["easy", / (اسهل|ابسط|اقل عنايه|easier|easiest|less care|lower maintenance) /],
  ["heat", /تتحمل (الحر|الشمس|الحراره)|اكثر تحمل|heat tolerant|handles heat|more heat|tolerates heat/],
  ["pets", / (امنه|امن|اسلم|safe|safer|safest) .*(قط|كلب|حيوان|cat|dog|pet)|(قط|كلب|cat|dog|pet).* (امنه|امن|safe|safer) /],
];
const WHICH = / (اي|ايهم|مين|وش|which|who|is|هل) |\?|؟/;
const NOT_SUPERLATIVE = / (خيارات|بدائل|options|alternatives|غيرها|ثانيه غير) /;

/** A comparative question about plants already on the table — not a request for new, cheaper options. */
export function detectCriterion(message: string): Criterion | null {
  const m = t(message);
  if (NOT_SUPERLATIVE.test(m)) return null;
  const hit = CRITERIA.find(([, re]) => re.test(m));
  if (!hit) return null;
  return WHICH.test(` ${message} `) || WHICH.test(m) || detectOrdinals(message).length ? hit[0] : null;
}

export interface CriterionRow { key: string; name: string; value: string | number | boolean | null; sold_in_store: boolean }
export interface CriterionAnswer { criterion: Criterion; rows: CriterionRow[]; winner: string | null; reason: "computed" | "tie" | "missing_data" }

const WATER_RANK = { low: 1, moderate: 2, high: 3 } as const;
const EASY_RANK = { easy: 1, moderate: 2, hard: 3 } as const;

/** Deterministic answer from verified data; no winner when any plant lacks the data or they tie. */
export function answerCriterion(criterion: Criterion, items: RefItem[], products: ProductWithSpecies[], species: Species[], ar: boolean, lower = true): CriterionAnswer {
  const rows: CriterionRow[] = [];
  const scores: (number | null)[] = [];
  for (const i of items) {
    const sp = i.species_slug ? species.find((s) => s.slug === i.species_slug) ?? null : null;
    const prods = storeProductsFor(i, products);
    const product = prods.length === 1 ? prods[0] : null;
    let value: CriterionRow["value"] = null;
    let score: number | null = null;
    if (criterion === "price") { value = product?.price_sar ?? null; score = product ? product.price_sar * (lower ? 1 : -1) : null; }
    if (criterion === "water" && sp) { value = sp.water; score = WATER_RANK[sp.water] * (lower ? 1 : -1); }
    if (criterion === "easy" && sp) { value = sp.difficulty; score = EASY_RANK[sp.difficulty]; }
    if (criterion === "heat" && sp) { value = sp.heat_tolerant; score = sp.heat_tolerant ? 0 : 1; }
    if (criterion === "pets" && sp) {
      const safe = sp.toxicity.cats === "non_toxic" && sp.toxicity.dogs === "non_toxic";
      const known = sp.toxicity.cats !== "unknown" && sp.toxicity.dogs !== "unknown";
      value = known ? safe : null; score = known ? (safe ? 0 : 1) : null;
    }
    rows.push({ key: i.key, name: itemName(i, ar), value, sold_in_store: prods.length > 0 });
    scores.push(score);
  }
  if (scores.some((s) => s === null)) return { criterion, rows, winner: null, reason: "missing_data" };
  const best = Math.min(...(scores as number[]));
  const winners = rows.filter((_, i) => scores[i] === best);
  return winners.length === 1 ? { criterion, rows, winner: winners[0].key, reason: "computed" } : { criterion, rows, winner: null, reason: "tie" };
}
export const asksForMore = (message: string) => / (اكثر|اغلي|more|pricier|more expensive) /.test(t(message)) && !/ (اقل|ارخص|less|cheaper) /.test(t(message));

// ───────────────────────── lists in Nada's own replies ─────────────────────────
const LIST_LINE = /^\s*(?:[-*•▪]|\d{1,2}[.)\-]|[١-٩][.)\-]|[٠-٩]{1,2}[.)])\s+(.+)$/;
const LATIN_IN_PARENS = /\(([A-Z][a-z]+(?: [a-z×-]+){0,2})\)/;
export const RECOMMEND_REQUEST = / (اقترحي|اقترح|اقترحيلي|انصحيني|انصحني|رشحي|ابي نبته|ابغي نبته|ابي نباتات|وش النباتات|وش انسب|خيارات|بدائل|غيرها|مختلف|ثانيه|نبتتين|نباتات|recommend|suggest|options|alternatives|which plants|other|different) /;

/**
 * Turns a numbered/bulleted list of plants in Nada's reply into ordered items, so a later
 * "الأولى/الثانية" means exactly what the customer saw. Lists of care steps are ignored: every line
 * must look like a plant (catalogue species, a Latin name in brackets, or a short name in reply to a
 * recommendation request).
 */
export function extractReplyList(reply: string, species: Species[], recommendationAsked: boolean): RefItem[] {
  const lines = reply.split(/\n+/).map((l) => l.match(LIST_LINE)?.[1]).filter((x): x is string => !!x);
  if (lines.length < 2) return [];
  const items: RefItem[] = [];
  for (const raw of lines.slice(0, 6)) {
    const line = raw.replace(/\*\*|__|`/g, "").trim();
    const head = line.split(/[:：]| [-–—] /)[0].trim();
    const latin = head.match(LATIN_IN_PARENS)?.[1] ?? line.match(LATIN_IN_PARENS)?.[1] ?? null;
    const name = head.replace(/\([^)]*\)/g, "").trim();
    if (!name || words(name).length > 4) return [];
    const sp = matchSpecies(latin ?? name, species).match ?? (latin ? matchSpecies(name, species).match : null);
    if (sp) { items.push(itemFromSpecies(sp)); continue; }
    if (!latin && !recommendationAsked) return [];
    const arabic = /[؀-ۿ]/.test(name);
    items.push({ key: `n:${words(latin ?? name).join("-")}`.slice(0, 120), name_ar: arabic ? name : latin ?? name, name_en: latin ?? (arabic ? "" : name), scientific: latin, species_slug: null, product_id: null });
  }
  return items;
}

export const asksForRecommendations = (message: string) => RECOMMEND_REQUEST.test(t(message));
/** "Show me its product page / price / is it available?" */
export const asksForProduct = (message: string) => / (صفحه|صفحتها|صفحته|المنتج|منتج|رابط|سعرها|سعره|بكم|كم سعر|متوفره|متوفر|موجوده عندكم|اشتريها|product|page|link|price|available|in stock|buy) /.test(t(message));
export const wantsCart = (message: string) => / (للسله|السله|سلتي|cart|basket) /.test(t(message));
export const wantsWishlist = (message: string) => / (للمفضله|المفضله|بالمفضله|مفضلتي|قائمه امنياتي|قائمه الامنيات|wishlist|favourites|favorites) /.test(t(message));
export const isLastActionQuestion = (message: string) => LAST_ACTION.test(t(message));
export const sameRequest = (a: string, b: string) => t(a) === t(b);
