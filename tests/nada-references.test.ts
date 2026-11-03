// Multi-turn reference regression tests (mocked Llama — no API calls).
// They reproduce the "قارني بين الأولى والثانية → Aloe vera" bug and pin down how Nada resolves
// references against the LATEST recommendation group, across reloads, customers and sessions.
import { describe, expect, it } from "vitest";
import { LOCAL_PRODUCTS, LOCAL_SPECIES } from "@/lib/catalog/local";
import { detectCriterion, extractReplyList, resolveReference } from "@/lib/ai/conversation";
import type { LlamaChat, LlamaMessage } from "@/lib/ai/llama";
import { runNada, type NadaData } from "@/lib/ai/nada";
import { ChatContextSchema, ChatRequestSchema, type ChatContext, type ChatResponse } from "@/lib/ai/schemas";
import { matchSpecies } from "@/lib/ai/species-match";

// ───────── harness ─────────
type U = Record<string, unknown>;
interface Turn { r: ChatResponse; facts: Record<string, any>; llmCalls: number }

function conversation(opts: { signedIn?: boolean } = {}) {
  const wishlist: string[] = [];
  const data: NadaData = {
    listUserPlants: async () => [], getCareLogs: async () => [], addCareLog: async () => true, addUserPlant: async () => null,
    upsertExplored: async () => {}, listExplored: async () => [], addToWishlist: async (id) => { wishlist.push(id); return true; },
  };
  const signedIn = opts.signedIn ?? true;
  let context: Partial<ChatContext> | null = null;
  let llmCalls = 0;
  const say = async (message: string, understanding: U, reply = "حاضر"): Promise<Turn> => {
    const calls: { messages: LlamaMessage[]; json: boolean }[] = [];
    const llm: LlamaChat = async (messages, o) => {
      calls.push({ messages, json: !!o?.json });
      llmCalls++;
      return o?.json ? JSON.stringify({ language: "ar", ...understanding }) : reply;
    };
    const r = await runNada({ message, history: [], context, sessionId: null }, {
      llm, model: "test", products: LOCAL_PRODUCTS, species: LOCAL_SPECIES, user: signedIn ? { id: "u1" } : null, data: signedIn ? data : null,
      now: () => new Date("2026-11-03T09:00:00Z"),
    });
    // Persist exactly as the app does: JSON in chat_sessions.context (server) or echoed by the client (guest).
    context = JSON.parse(JSON.stringify(r.context));
    const factsMsg = calls.find((c) => !c.json)?.messages.find((m) => m.content.startsWith("FACTS"));
    const facts = factsMsg ? JSON.parse(factsMsg.content.split("\n").slice(1).join("\n")) : {};
    return { r, facts, llmCalls: calls.length };
  };
  return { say, wishlist, get context() { return context; }, set context(c) { context = c; }, get llmCalls() { return llmCalls; } };
}

const product = (slug: string) => LOCAL_PRODUCTS.find((p) => p.species_slug === slug && p.kind === "plant")!;
const list = (...lines: string[]) => `أبشر، هذي اقتراحاتي:\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}\nوش رايك؟`;
const MONSTERA_POTHOS = list("**مونستيرا (Monstera deliciosa)**: أوراقها كبيرة", "**بوتس ذهبي (Epipremnum aureum)**: سهل جدًا");
const ZINNIA_PAPAYA = list("الزينيا (Zinnia elegans): زهور ملونة للشمس", "البابايا (Carica papaya): شجرة فاكهة للحديقة");
const ZZ_POTHOS = list("زاميا (Zamioculcas zamiifolia): تتحمل الإهمال", "بوتس ذهبي (Epipremnum aureum): متدلية");
const PEACE_PILEA = list("زنبق السلام (Spathiphyllum wallisii): ينقي الجو", "بيليا (Pilea peperomioides): صغيرة ولطيفة");
const names = (facts: any, key = "compare") => (facts[key] as { name: string }[]).map((x) => x.name);
const speciesSlugs = (r: ChatResponse) => r.blocks.flatMap((b) => (b.type === "species" ? [b.item.slug] : []));
const productIds = (r: ChatResponse) => r.blocks.flatMap((b) => (b.type === "products" ? b.items.map((i) => i.id) : []));

// ───────── unit: strict species matching ─────────
describe("strict species matching (no silent substitution)", () => {
  it.each([
    ["فيكس ليراتا", "ficus-lyrata"],
    ["صبار البرميل", "echinocactus-grusonii"],
    ["الألوفيرا", "aloe-vera"],
    ["مونستيرا كبيرة", "monstera-deliciosa"],
    ["Epipremnum aureum", "epipremnum-aureum"],
  ])("%s → %s", (m, slug) => expect(matchSpecies(m, LOCAL_SPECIES).match?.slug).toBe(slug));

  it.each(["صبار", "نبتة الصبار", "فيكس", "كالاثيا"])("'%s' is ambiguous: no single species, candidates offered", (m) => {
    const r = matchSpecies(m, LOCAL_SPECIES);
    expect(r.match).toBeNull();
    expect(r.candidates.length).toBeGreaterThan(1);
  });

  it.each(["الزينيا", "Zinnia", "البابايا", "Carica papaya", "الصبار الذهبي"])("'%s' (not in the catalogue) resolves to nothing", (m) => {
    expect(matchSpecies(m, LOCAL_SPECIES).match).toBeNull();
  });
});

// ───────── unit: reference expressions ─────────
describe("Arabic reference expressions", () => {
  const ctx = (): ChatContext => {
    const c = ChatContextSchema.parse({});
    const mk = (k: string) => ({ key: k, name_ar: k, name_en: k, scientific: null, species_slug: null, product_id: null });
    c.rec_sets = [{ id: 1, source: "reply", items: [mk("A"), mk("B")] }, { id: 3, source: "reply", items: [mk("C"), mk("D"), mk("E")] }];
    c.active_set = 3;
    return c;
  };
  const keys = (m: string, c = ctx()) => { const r = resolveReference(m, c); return r.kind === "items" ? r.items.map((i) => i.key) : r.kind; };

  it.each([
    ["قارني بين الأولى والثانية", ["C", "D"]],
    ["وش رايك بالثالثة؟", ["E"]],
    ["الخيار الأول كم سعره", ["C"]],
    ["آخر وحدة", ["E"]],
    ["آخر نبتتين اقترحتيهم", ["D", "E"]],
    ["قارني بينهم", ["C", "D", "E"]],
    ["أضيفي الثانية للسلة", ["D"]],
    ["احفظي الأولى بالمفضلة", ["C"]],
    ["الخيارات السابقة", ["A", "B"]],
    ["الأولى من الاقتراحات الأولى", ["A"]],
    ["first one please", ["C"]],
  ])("%s → %j", (m, expected) => expect(keys(m)).toEqual(expected));

  it("demonstratives use the focused plant; without one they are ambiguous, not guessed", () => {
    const c = ctx();
    expect(keys("هذي", c)).toBe("ambiguous");
    expect(keys("ذيك", c)).toBe("ambiguous");
    c.focus_item = c.rec_sets[1].items[1];
    for (const m of ["هذي", "ذيك", "أضيفيها للمفضلة", "النبتة اللي قلتي عنها قبل شوي", "وش اسم النبتة اللي اخترتيها؟"]) expect(keys(m, c), m).toEqual(["D"]);
  });

  it("'خيارات ثانية' (other options) is not the ordinal 'second'", () => {
    expect(resolveReference("أبي خيارات ثانية", ctx()).kind).toBe("none");
    expect(detectCriterion("وريني خيارات أرخص")).toBeNull();
    expect(detectCriterion("أي وحدة أرخص؟")).toBe("price");
    expect(detectCriterion("أي وحدة تحتاج ري أقل؟")).toBe("water");
  });

  it("a numbered list of care steps is not mistaken for plants", () => {
    expect(extractReplyList(list("اسقها لما تجف التربة تمامًا من فوق", "حطها قريب من شباك شمالي بدون شمس مباشرة"), LOCAL_SPECIES, false)).toEqual([]);
  });
});

// ───────── multi-turn scenarios ─────────
describe("Test A — the latest recommendation group wins", () => {
  it("compares Zinnia and Papaya, not an older group or an unrelated Aloe vera card", async () => {
    const c = conversation();
    await c.say("اقترحي لي نباتات للصالة", { intent: "general_question" }, MONSTERA_POTHOS);
    await c.say("لا أبي شي مختلف للحديقة", { intent: "general_question" }, ZINNIA_PAPAYA);
    // The model gets it wrong on purpose (stale mention from history) — the server must not follow it.
    const t = await c.say("قارني بين الأولى والثانية", { intent: "compare_plants", species_mentions: ["صبار"] });
    expect(names(t.facts)).toEqual(["الزينيا", "البابايا"]);
    expect(t.facts.compare.every((x: any) => x.store.sold_in_al_nada === false && x.verified_botanical_data === null)).toBe(true);
    expect(speciesSlugs(t.r)).not.toContain("aloe-vera");
    expect(productIds(t.r)).toEqual([]);
    expect(t.r.blocks.filter((b) => b.type === "notice")).toHaveLength(2);
    expect(t.r.context.rec_sets.at(-1)!.items.map((i) => i.name_ar)).toEqual(["الزينيا", "البابايا"]); // comparison did not reorder the group
  });
});

describe("Test B — explicit reference to an older group", () => {
  it("retrieves the first group when the customer asks for it", async () => {
    const c = conversation();
    await c.say("اقترحي لي نبتتين", { intent: "general_question" }, MONSTERA_POTHOS);
    await c.say("أبي خيارات ثانية", { intent: "general_question" }, PEACE_PILEA);
    const t = await c.say("قارني بين الاقتراحات الأولى", { intent: "compare_plants" });
    expect(names(t.facts)).toEqual(["مونستيرا", "بوتس ذهبي"]);
    const prev = await c.say("وش كانت الخيارات السابقة؟", { intent: "general_question" });
    expect(names(prev.facts, "referenced")).toEqual(["مونستيرا", "بوتس ذهبي"]);
    // …and the latest group is still the active one afterwards.
    const latest = await c.say("قارني بين الأولى والثانية", { intent: "compare_plants" });
    expect(names(latest.facts)).toEqual(["زنبق السلام", "بيليا (نبتة النقود الصينية)"]);
  });
});

describe("Test C — focused plant reference", () => {
  it("'أضيفيها للمفضلة' after discussing the second plant adds the second plant", async () => {
    const c = conversation();
    await c.say("اقترحي لي نبتتين لمكتبي", { intent: "general_question" }, ZZ_POTHOS);
    const about = await c.say("حدثيني أكثر عن الثانية", { intent: "general_question" });
    expect(names(about.facts, "referenced")).toEqual(["بوتس ذهبي"]);
    // The model even suggests index 1 — the focused plant must win.
    const t = await c.say("أضيفيها للمفضلة", { intent: "save_to_wishlist", reference_index: 1 });
    expect(c.wishlist).toEqual([product("epipremnum-aureum").id]);
    expect(t.r.blocks.find((b) => b.type === "action")).toMatchObject({ status: "success" });
    expect(t.r.context.rec_sets.at(-1)!.items.map((i) => i.species_slug)).toEqual(["zamioculcas-zamiifolia", "epipremnum-aureum"]);
  });
});

describe("Test D — follow-up after a comparison", () => {
  it("'which needs less water?' is computed, then 'أضيفي هذي للسلة' adds that plant", async () => {
    const c = conversation();
    await c.say("اقترحي لي نبتتين", { intent: "general_question" }, list("زاميا (Zamioculcas zamiifolia): قوية", "زنبق السلام (Spathiphyllum wallisii): يزهر"));
    await c.say("قارني بين الأولى والثانية", { intent: "compare_plants" });
    const q = await c.say("أي وحدة تحتاج ري أقل؟", { intent: "general_question" });
    expect(q.facts.answer).toMatchObject({ criterion: "water", result: "computed", winner: "زاميا (زد زد)" });
    const t = await c.say("طيب أضيفي هذي للسلة", { intent: "add_to_cart" });
    expect(t.r.clientActions).toEqual([{ type: "add_to_cart", productId: product("zamioculcas-zamiifolia").id }]);
  });

  it("asks for clarification instead of guessing when the comparison is a tie", async () => {
    const c = conversation();
    await c.say("اقترحي لي نبتتين", { intent: "general_question" }, list("بوتس ذهبي (Epipremnum aureum): سهلة", "بيليا (Pilea peperomioides): صغيرة"));
    await c.say("قارني بينهم", { intent: "compare_plants" });
    const q = await c.say("أي وحدة تحتاج ري أقل؟", { intent: "general_question" });
    expect(q.facts.answer).toMatchObject({ result: "tie", winner: null });
    const t = await c.say("طيب أضيفي هذي للسلة", { intent: "add_to_cart" });
    expect(t.r.clientActions).toEqual([]);
    expect(t.r.blocks.find((b) => b.type === "action")).toMatchObject({ status: "needs_choice" });
  });
});

describe("Spec scenario — shopping actions follow the latest group", () => {
  it("compares C/D, answers the price from the catalogue, wishlists D (not B) and recalls it", async () => {
    const c = conversation();
    await c.say("اقترحي لي نبتتين لمكتبي.", { intent: "general_question" }, ZZ_POTHOS); // A, B
    await c.say("أبي خيارات ثانية.", { intent: "general_question" }, PEACE_PILEA); // C, D
    const cmp = await c.say("قارني بين الأولى والثانية.", { intent: "compare_plants" });
    expect(names(cmp.facts)).toEqual(["زنبق السلام", "بيليا (نبتة النقود الصينية)"]);
    const price = await c.say("الثانية أرخص؟", { intent: "cheaper_options" });
    expect(price.facts.answer).toMatchObject({ criterion: "price", asked_about: "بيليا (نبتة النقود الصينية)", winner: "بيليا (نبتة النقود الصينية)" });
    expect(price.facts.answer.rows.map((r: any) => r.value)).toEqual([product("pilea-peperomioides").price_sar, product("spathiphyllum-wallisii").price_sar]);
    await c.say("طيب أضيفيها للمفضلة.", { intent: "save_to_wishlist" });
    expect(c.wishlist).toEqual([product("pilea-peperomioides").id]);
    const what = await c.say("وش أضفتي؟", { intent: "general_question" });
    expect(names(what.facts, "referenced")).toEqual(["بيليا (نبتة النقود الصينية)"]);
  });

  it("does not repeat an action when the same request is sent twice in a row", async () => {
    const c = conversation();
    await c.say("اقترحي لي نبتتين", { intent: "general_question" }, ZZ_POTHOS);
    const first = await c.say("أضيفي الثانية للسلة", { intent: "add_to_cart" });
    const again = await c.say("أضيفي الثانية للسلة", { intent: "add_to_cart" });
    expect(first.r.clientActions).toHaveLength(1);
    expect(again.r.clientActions).toHaveLength(0);
    expect(again.r.blocks.find((b) => b.type === "action")).toMatchObject({ status: "success" });
  });
});

describe("Test E — page reload / reopened conversation", () => {
  it("restores the active group from the saved context", async () => {
    const c = conversation({ signedIn: false });
    await c.say("اقترحي لي نبتتين", { intent: "general_question" }, PEACE_PILEA);
    // Guest path: the context round-trips through the request schema; signed-in: through chat_sessions.context JSON.
    const body = ChatRequestSchema.parse({ message: "وش كانت الثانية؟", context: c.context });
    c.context = body.context ?? null;
    const t = await c.say("وش كانت الثانية؟", { intent: "general_question" });
    expect(names(t.facts, "referenced")).toEqual(["بيليا (نبتة النقود الصينية)"]);
  });

  it("migrates conversations saved before recommendation groups existed", async () => {
    const c = conversation();
    const legacy = [product("zamioculcas-zamiifolia").id, product("epipremnum-aureum").id];
    c.context = { last_recommended: legacy, workflow: "finder" };
    const t = await c.say("أضيفي الثانية للسلة", { intent: "add_to_cart" });
    expect(t.r.clientActions).toEqual([{ type: "add_to_cart", productId: legacy[1] }]);
  });
});

describe("Test F — catalogue mismatch", () => {
  it("reports that a recommended plant is not sold instead of substituting Aloe vera", async () => {
    const c = conversation();
    await c.say("أبي نباتات للحديقة", { intent: "general_question" }, ZINNIA_PAPAYA);
    const page = await c.say("وريني صفحة المنتج للأولى", { intent: "general_question", species_mentions: ["صبار"] });
    expect(productIds(page.r)).toEqual([]);
    expect(speciesSlugs(page.r)).toEqual([]);
    expect(page.r.blocks.find((b) => b.type === "notice")).toMatchObject({ message: expect.stringContaining("الزينيا غير متوفرة") });
    const cart = await c.say("طيب أضيفي الأولى للسلة", { intent: "add_to_cart", species_mentions: ["صبار"] });
    expect(cart.r.clientActions).toEqual([]);
    expect(cart.facts.action).toMatchObject({ status: "failed", reason: "not_sold_in_al_nada" });
  });

  it("asks which plant when a typed name is ambiguous ('صبار')", async () => {
    const c = conversation();
    const t = await c.say("أضيفي الصبار للسلة", { intent: "add_to_cart", species_mentions: ["صبار"] });
    expect(t.r.clientActions).toEqual([]);
    expect(t.r.blocks.find((b) => b.type === "action")).toMatchObject({ status: "needs_choice" });
  });
});

describe("Test G — separate customers and conversations", () => {
  it("never resolves references against another conversation's recommendations", async () => {
    const one = conversation();
    const two = conversation();
    await one.say("أبي نباتات للحديقة", { intent: "general_question" }, ZINNIA_PAPAYA);
    await two.say("اقترحي لي نباتات للصالة", { intent: "general_question" }, MONSTERA_POTHOS);
    const a = await one.say("قارني بين الأولى والثانية", { intent: "compare_plants" });
    const b = await two.say("قارني بين الأولى والثانية", { intent: "compare_plants" });
    expect(names(a.facts)).toEqual(["الزينيا", "البابايا"]);
    expect(names(b.facts)).toEqual(["مونستيرا", "بوتس ذهبي"]);
    const fresh = conversation();
    const none = await fresh.say("قارني بين الأولى والثانية", { intent: "compare_plants" });
    expect(none.facts.compare).toBeUndefined();
    expect(none.facts.reference_problem).toBeTruthy();
  });
});

describe("inference budget", () => {
  it("uses exactly two Llama calls per turn (one understanding, one reply) for reference turns", async () => {
    const c = conversation();
    await c.say("اقترحي لي نبتتين", { intent: "general_question" }, ZZ_POTHOS);
    const t = await c.say("قارني بين الأولى والثانية", { intent: "compare_plants" });
    expect(t.llmCalls).toBe(2);
  });
});
