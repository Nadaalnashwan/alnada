// Personal plant recognition (mocked Llama — no API calls).
// Reproduces "وش الإضاءة المناسبة لفله؟" being answered with a generic guess (Philodendron) instead of the
// customer's own saved Arabian jasmine, and pins down nickname resolution for any customer and plant.
import { describe, expect, it } from "vitest";
import { LOCAL_PRODUCTS, LOCAL_SPECIES } from "@/lib/catalog/local";
import type { LlamaChat, LlamaMessage } from "@/lib/ai/llama";
import { runNada, type NadaData, type UserPlantRecord } from "@/lib/ai/nada";
import { ChatRequestSchema, type ChatContext, type ChatResponse } from "@/lib/ai/schemas";
import { findUserPlantMentions } from "@/lib/ai/user-plant-match";

const plant = (id: string, nickname: string | null, species_slug: string, extra: Partial<UserPlantRecord> = {}): UserPlantRecord => ({
  id, nickname, species_slug, unconfirmed_label: null, location: "الصالة", light_condition: "bright_indirect", watering_preference: null,
  source: "manual", created_at: "2026-10-01T10:00:00Z", last_watered_at: null, ...extra,
});
const FULLA = plant("aaaaaaaa-0000-4000-8000-000000000001", "فله", "jasminum-sambac", { location: "البلكونة" });
const LULU = plant("aaaaaaaa-0000-4000-8000-000000000002", "لولو", "monstera-deliciosa", { location: "غرفة النوم", light_condition: "medium" });
const ZIZI = plant("aaaaaaaa-0000-4000-8000-000000000003", "زيزي", "dracaena-trifasciata");

function customer(plants: UserPlantRecord[], opts: { saveOk?: boolean } = {}) {
  const saved: { plantId: string; activity: string }[] = [];
  const data: NadaData = {
    listUserPlants: async () => plants,
    getCareLogs: async (_id, o) => [{ activity: "watering", occurred_at: "2026-10-30T08:00:00Z", notes: null }].filter((l) => !o?.activity || l.activity === o.activity),
    addCareLog: async (plantId, activity) => { if (opts.saveOk === false) return false; saved.push({ plantId, activity }); return true; }, addUserPlant: async () => null, upsertExplored: async () => {}, listExplored: async () => [], addToWishlist: async () => true,
  };
  let context: Partial<ChatContext> | null = null;
  const say = async (message: string, understanding: Record<string, unknown>, opts: { userPlantId?: string; reply?: string; signedIn?: boolean } = {}) => {
    const calls: { messages: LlamaMessage[]; json: boolean }[] = [];
    const llm: LlamaChat = async (messages, o) => { calls.push({ messages, json: !!o?.json }); return o?.json ? JSON.stringify({ language: "ar", ...understanding }) : opts.reply ?? "حاضر"; };
    const signedIn = opts.signedIn ?? true;
    const r: ChatResponse = await runNada({ message, history: [], context, sessionId: null, userPlantId: opts.userPlantId ?? null }, {
      llm, model: "test", products: LOCAL_PRODUCTS, species: LOCAL_SPECIES, user: signedIn ? { id: "u" } : null, data: signedIn ? data : null,
      now: () => new Date("2026-11-03T09:00:00Z"),
    });
    context = JSON.parse(JSON.stringify(r.context)); // persisted like chat_sessions.context
    const f = calls.find((c) => !c.json)?.messages.find((m) => m.content.startsWith("FACTS"));
    return { r, facts: f ? JSON.parse(f.content.split("\n").slice(1).join("\n")) : {} };
  };
  return { say, saved, get context() { return context; }, set context(c) { context = c; } };
}

// What Llama actually did in the bug report: a "general question" with the nickname read as a species.
const misread = (name: string) => ({ intent: "general_question", species_mentions: [name] });
const speciesBlocks = (r: ChatResponse) => r.blocks.flatMap((b) => (b.type === "species" ? [b.item.slug] : []));

describe("nickname matching (any customer, any plant)", () => {
  const plants = [FULLA, LULU, ZIZI];
  it.each([
    ["وش الإضاءة المناسبة لفله؟", FULLA.id], ["تعرف وش أقصد بفله؟", FULLA.id], ["كيف أعتني بالفلة؟", FULLA.id],
    ["فلّة تحتاج شمس؟", FULLA.id], ["وفلة؟", FULLA.id], ["زيزي تحتاج ري كثير؟", ZIZI.id], ["سقيت لولو اليوم", LULU.id],
  ])("%s → the saved plant", (m, id) => expect(findUserPlantMentions(m, plants, LOCAL_SPECIES).byNickname.map((p) => p.id)).toEqual([id]));

  it("matches a nickname saved with the article and diacritics ('الفلّة') when typed as 'فله'", () => {
    const p = plant("aaaaaaaa-0000-4000-8000-000000000009", "الفلّة", "jasminum-sambac");
    expect(findUserPlantMentions("وش الإضاءة المناسبة لفله؟", [p], LOCAL_SPECIES).byNickname).toEqual([p]);
  });

  it("does not match inside other words", () => {
    for (const m of ["عندي فلفل في المطبخ", "فلهم نبتة", "زيزفون"]) expect(findUserPlantMentions(m, plants, LOCAL_SPECIES).byNickname, m).toEqual([]);
  });

  it("also finds a saved plant by its species name (Arabic, English, scientific)", () => {
    for (const m of ["الفل العربي حقي يحتاج شمس؟", "my Arabian jasmine", "Jasminum sambac"]) expect(findUserPlantMentions(m, plants, LOCAL_SPECIES).bySpecies.map((p) => p.id), m).toEqual([FULLA.id]);
  });
});

describe("Nada recognises the customer's saved plant", () => {
  it.each(["وش الإضاءة المناسبة لفله؟", "تعرف وش أقصد بفله؟", "كيف أعتني بالفلة؟", "فلّة تحتاج شمس؟"])("%s → Jasminum sambac record, never a guess", async (m) => {
    const c = customer([FULLA, LULU]);
    const { r, facts } = await c.say(m, misread("فله"));
    expect(facts.user_plant.nickname).toBe("فله");
    expect(facts.user_plant.species.scientific).toBe("Jasminum sambac");
    expect(facts.user_plant.species.light).toEqual(LOCAL_SPECIES.find((s) => s.slug === "jasminum-sambac")!.light);
    expect(facts.user_plant.location).toBe("البلكونة");
    expect(facts.user_plant.recent_care_logs.length).toBe(1);
    expect(facts.recognized_saved_plant).toMatchObject({ nickname: "فله", scientific: "Jasminum sambac" });
    expect(facts.unknown_species_mentioned).toBeUndefined();
    expect(speciesBlocks(r)).not.toContain("philodendron-hederaceum");
    expect(r.blocks.find((b) => b.type === "user_plants")).toMatchObject({ items: [{ id: FULLA.id }] });
    expect(r.context.focus_user_plant).toBe(FULLA.id);
  });

  it("asks which plant when two saved plants share the nickname", async () => {
    const twin = plant("aaaaaaaa-0000-4000-8000-000000000004", "فلة", "jasminum-sambac", { location: "المكتب" });
    const c = customer([FULLA, twin]);
    const { r } = await c.say("كيف حال فله؟", misread("فله"));
    expect(r.blocks.find((b) => b.type === "action")).toMatchObject({ status: "needs_choice", choices: [{ id: FULLA.id }, { id: twin.id }] });
  });
});

describe("sidebar selection and follow-ups", () => {
  it("keeps the selected plant for follow-ups until the customer names another one", async () => {
    const c = customer([FULLA, LULU]);
    const first = await c.say("وش الإضاءة المناسبة لها؟", { intent: "get_plant_care" }, { userPlantId: LULU.id });
    expect(first.facts.user_plant.nickname).toBe("لولو");
    // The UI no longer sends the selection; the server context keeps the plant.
    const follow = await c.say("وكم مرة أسقيها؟", { intent: "general_question" });
    expect(follow.facts.user_plant.nickname).toBe("لولو");
    // Naming another saved plant switches explicitly — even while a plant is selected.
    const sw = await c.say("طيب وفله؟", misread("فله"), { userPlantId: LULU.id });
    expect(sw.facts.user_plant.nickname).toBe("فله");
    const after = await c.say("هي تحتاج شمس مباشرة؟", { intent: "general_question" });
    expect(after.facts.user_plant.nickname).toBe("فله");
  });

  it("works across a reload / reopened conversation", async () => {
    const c = customer([FULLA, LULU]);
    await c.say("كيف أعتني بفله؟", misread("فله"));
    c.context = ChatRequestSchema.parse({ message: "x", context: c.context }).context ?? null;
    const t = await c.say("متى أسقيها؟", { intent: "general_question" });
    expect(t.facts.user_plant.nickname).toBe("فله");
  });

  it("never confuses the saved plant with earlier recommendations", async () => {
    const c = customer([FULLA]);
    await c.say("اقترحي لي نبتتين للصالة", { intent: "general_question" }, { reply: "1. مونستيرا (Monstera deliciosa): كبيرة\n2. بوتس ذهبي (Epipremnum aureum): سهلة" });
    const own = await c.say("وش الإضاءة المناسبة لفله؟", misread("فله"));
    expect(own.facts.user_plant.nickname).toBe("فله");
    expect(own.facts.referenced).toBeUndefined();
    const pron = await c.say("هي تتحمل المكيف؟", { intent: "general_question" });
    expect(pron.facts.user_plant.nickname).toBe("فله");
    expect(pron.r.blocks.some((b) => b.type === "action" && b.status === "needs_choice")).toBe(false);
    // The recommendation group is untouched and still answers ordinals.
    const cmp = await c.say("قارني بين الأولى والثانية", { intent: "compare_plants" });
    expect(cmp.facts.compare.map((x: { name: string }) => x.name)).toEqual(["مونستيرا", "بوتس ذهبي"]);
  });
});

describe("customer data isolation", () => {
  it("another customer (or a guest) saying 'فله' gets no one else's plant", async () => {
    const owner = customer([FULLA]);
    const other = customer([ZIZI]);
    expect((await owner.say("وش الإضاءة المناسبة لفله؟", misread("فله"))).facts.user_plant.nickname).toBe("فله");
    const b = await other.say("وش الإضاءة المناسبة لفله؟", misread("فله"));
    expect(b.facts.user_plant).toBeUndefined();
    expect(JSON.stringify(b.facts)).not.toContain(FULLA.id);
    const guest = await customer([FULLA]).say("وش الإضاءة المناسبة لفله؟", misread("فله"), { signedIn: false });
    expect(guest.facts.user_plant).toBeUndefined();
  });
});

describe("the companion conversation from the brief", () => {
  it("light → last watering → scientific name → log a watering, all on the same saved plant", async () => {
    const c = customer([FULLA, LULU, ZIZI]);
    const light = await c.say("وش الإضاءة المناسبة للولو؟", misread("للولو"));
    expect(light.facts.user_plant).toMatchObject({ nickname: "لولو", location: "غرفة النوم" });
    expect(light.facts.user_plant.species.light).toEqual(LOCAL_SPECIES.find((s) => s.slug === "monstera-deliciosa")!.light);

    const last = await c.say("طيب متى آخر مرة سقيتها؟", { intent: "get_plant_history", care_activity: "watering" });
    expect(last.facts.plant).toContain("لولو");
    expect(last.facts.records).toEqual([{ date: "2026-10-30", notes: null }]);

    const sci = await c.say("وش اسمها العلمي؟", { intent: "general_question" });
    expect(sci.facts.user_plant.species.scientific).toBe("Monstera deliciosa");

    const log = await c.say("طيب سجلي إني سقيتها اليوم.", { intent: "save_care_log", care_activity: "watering", activity_when: "today" });
    expect(c.saved).toEqual([{ plantId: LULU.id, activity: "watering" }]);
    expect(log.facts.action).toMatchObject({ status: "success", activity: "watering" });
    expect(log.facts.must_state).toContain("لولو");
  });

  it("confirms nothing when Supabase does not save the care log", async () => {
    const c = customer([LULU], { saveOk: false });
    await c.say("كيف حال لولو؟", misread("لولو"));
    const log = await c.say("سقيتها اليوم", { intent: "save_care_log", care_activity: "watering", activity_when: "today" });
    expect(log.facts.action).toMatchObject({ status: "failed" });
    expect(log.r.blocks.find((b) => b.type === "action")).toMatchObject({ status: "failed" });
  });
});

describe("any nickname, any plant", () => {
  const ALOE = plant("aaaaaaaa-0000-4000-8000-000000000005", "صبورة", "aloe-vera", { location: "المطبخ" });
  const DEAR = plant("aaaaaaaa-0000-4000-8000-000000000006", "حبيبتي", "spathiphyllum-wallisii");
  it.each([
    ["صبوره تحتاج ري كثير؟", ALOE, "Aloe vera"],
    ["وش أحسن مكان لصبورة؟", ALOE, "Aloe vera"],
    ["حبيبتي أوراقها لامعة، كيف أخليها كذا؟", DEAR, "Spathiphyllum wallisii"],
    ["كم مرة أسقي حبيبتي؟", DEAR, "Spathiphyllum wallisii"],
  ])("%s → %s", async (m, p, sci) => {
    const { facts } = await customer([ALOE, DEAR, LULU]).say(m, misread(m.split(" ")[0]));
    expect(facts.user_plant.nickname).toBe(p.nickname);
    expect(facts.user_plant.species.scientific).toBe(sci);
  });

  it("tolerates one typing slip in a longer nickname, but never an everyday word", () => {
    const plants = [ALOE, DEAR, LULU];
    expect(findUserPlantMentions("صبوزة تحتاج شمس؟", plants, LOCAL_SPECIES).byNickname).toEqual([ALOE]); // ر → ز
    expect(findUserPlantMentions("حبيتبي تحتاج ري؟", plants, LOCAL_SPECIES).byNickname).toEqual([DEAR]); // swapped letters
    expect(findUserPlantMentions("يا حبيبي ساعدني", plants, LOCAL_SPECIES).byNickname).toEqual([]); // dropped letter: different word
    expect(findUserPlantMentions("لولي تحتاج ري؟", plants, LOCAL_SPECIES).byNickname).toEqual([]); // short names: exact only
  });

  it("does not guess when a typo fits two of the customer's plants", () => {
    const a = plant("aaaaaaaa-0000-4000-8000-000000000007", "ريحانة", "ocimum-basilicum");
    const b = plant("aaaaaaaa-0000-4000-8000-000000000008", "ريحانه", "mentha-spicata");
    // Both normalise to the same name → exact match on both → clarification, not a guess.
    expect(findUserPlantMentions("ريحانة تحتاج ري؟", [a, b], LOCAL_SPECIES).byNickname).toHaveLength(2);
    const near = plant("aaaaaaaa-0000-4000-8000-000000000010", "ريجانة", "mentha-spicata");
    expect(findUserPlantMentions("ريخانة تحتاج ري؟", [a, near], LOCAL_SPECIES).byNickname).toEqual([]);
  });
});
