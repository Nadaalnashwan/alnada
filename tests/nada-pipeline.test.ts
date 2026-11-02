// Pipeline tests with a scripted stand-in for Llama and an in-memory data store.
// They verify the deterministic parts: validation, authorised retrieval, actions and grounding facts.
import { describe, expect, it } from "vitest";
import { LOCAL_PRODUCTS, LOCAL_SPECIES } from "@/lib/catalog/local";
import { resolveSpecies, runNada, type CareLogRecord, type NadaData, type UserPlantRecord } from "@/lib/ai/nada";
import type { LlamaChat, LlamaMessage } from "@/lib/ai/llama";

function scriptedLlm(understanding: Record<string, unknown> | string) {
  const calls: { messages: LlamaMessage[]; json: boolean }[] = [];
  const llm: LlamaChat = async (messages, opts) => {
    calls.push({ messages, json: !!opts?.json });
    if (opts?.json) return typeof understanding === "string" ? understanding : JSON.stringify(understanding);
    return "رد ندى";
  };
  const factsOf = () => JSON.parse(calls.find((c) => !c.json)!.messages.find((m) => m.content.startsWith("FACTS"))!.content.split("\n").slice(1).join("\n"));
  return { llm, calls, factsOf };
}

function memoryData(plants: UserPlantRecord[] = []) {
  const logs = new Map<string, CareLogRecord[]>();
  const wishlist: string[] = [];
  const explored: { species_slug: string; product_id: string | null; reason: string; last_explored_at: string }[] = [];
  const data: NadaData = {
    listUserPlants: async () => plants,
    getCareLogs: async (id, o) => (logs.get(id) ?? []).filter((l) => !o?.activity || l.activity === o.activity).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, o?.limit ?? 10),
    addCareLog: async (id, activity, occurred_at, notes) => { logs.set(id, [...(logs.get(id) ?? []), { activity, occurred_at, notes }]); return true; },
    addUserPlant: async () => "11111111-1111-4111-8111-111111111111",
    upsertExplored: async (e) => { explored.push({ ...e, last_explored_at: new Date().toISOString() }); },
    listExplored: async () => explored,
    addToWishlist: async (id) => { wishlist.push(id); return true; },
  };
  return { data, logs, wishlist, explored };
}

const lulu: UserPlantRecord = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", nickname: "لولو", species_slug: "monstera-deliciosa", unconfirmed_label: null,
  location: "غرفة النوم", light_condition: "medium", watering_preference: null, source: "manual", created_at: "2026-10-01T10:00:00Z", last_watered_at: null,
};
const base = { history: [], context: null, sessionId: null };
const deps = (llm: LlamaChat, data: NadaData | null, user = true) => ({
  llm, model: "test", products: LOCAL_PRODUCTS, species: LOCAL_SPECIES, user: user ? { id: "u1" } : null, data,
  now: () => new Date("2026-11-02T09:00:00Z"),
});

describe("species resolution", () => {
  it("resolves Arabic, English, scientific names and aliases", () => {
    expect(resolveSpecies("مونستيرا", LOCAL_SPECIES)?.slug).toBe("monstera-deliciosa");
    expect(resolveSpecies("snake plant", LOCAL_SPECIES)?.slug).toBe("dracaena-trifasciata");
    expect(resolveSpecies("Ficus lyrata", LOCAL_SPECIES)?.slug).toBe("ficus-lyrata");
    expect(resolveSpecies("الفل", LOCAL_SPECIES)?.slug).toBe("jasminum-sambac");
    expect(resolveSpecies("xyzzy", LOCAL_SPECIES)).toBeNull();
  });
});

describe("Nada AI pipeline", () => {
  it("Test 1: recommends real catalogue products with images and stores context", async () => {
    const { llm, factsOf } = scriptedLlm({ intent: "recommend_plant", language: "ar", preferences: { placement: "indoor", light: "low", pets: ["cat"] } });
    const r = await runNada({ ...base, message: "أبي نبتة لغرفتي وإضاءتها ضعيفة وعندي قطة" }, deps(llm, null, false));
    const block = r.blocks.find((b) => b.type === "products");
    expect(block && block.type === "products" && block.items.length).toBeGreaterThan(0);
    if (block?.type === "products") for (const i of block.items) {
      const p = LOCAL_PRODUCTS.find((x) => x.id === i.id)!;
      expect(p.species!.toxicity.cats).toBe("non_toxic");
      expect(i.image).toMatch(/^(\/images\/catalog\/.+\.webp|https:)/);
    }
    expect(r.context.last_recommended.length).toBeGreaterThan(0);
    expect(factsOf().recommendations.length).toBeGreaterThan(0);
  });

  it("'cheaper options' keeps prior conditions and lowers the price ceiling", async () => {
    const first = await runNada({ ...base, message: "x" }, deps(scriptedLlm({ intent: "recommend_plant", language: "ar", preferences: { placement: "balcony", light: "full_sun", afternoon_sun: true, city: "الرياض" } }).llm, null, false));
    const prevMin = Math.min(...LOCAL_PRODUCTS.filter((p) => first.context.last_recommended.includes(p.id)).map((p) => p.price_sar));
    const second = await runNada({ ...base, message: "وريني خيارات أرخص", context: first.context }, deps(scriptedLlm({ intent: "cheaper_options", language: "ar" }).llm, null, false));
    expect(second.context.preferences.placement).toBe("balcony");
    expect(second.context.preferences.afternoon_sun).toBe(true);
    const block = second.blocks.find((b) => b.type === "products");
    if (block?.type === "products") for (const i of block.items) expect(i.price).toBeLessThan(prevMin);
  });

  it("Test 6/3: personal care resolves the saved nickname and sends only relevant plant data", async () => {
    const { data } = memoryData([lulu]);
    const { llm, factsOf } = scriptedLlm({ intent: "get_plant_care", language: "ar", plant_nickname: "لولو" });
    const r = await runNada({ ...base, message: "كيف أعتني بلولو؟" }, deps(llm, data));
    expect(r.context.focus_user_plant).toBe(lulu.id);
    const f = factsOf();
    expect(f.user_plant.nickname).toBe("لولو");
    expect(f.user_plant.location).toBe("غرفة النوم");
    expect(JSON.stringify(f)).not.toMatch(/@|email/i);
    expect(r.blocks.some((b) => b.type === "checklist")).toBe(true);
  });

  it("asks which plant when a nickname is ambiguous", async () => {
    const { data } = memoryData([lulu, { ...lulu, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", location: "الصالة" }]);
    const r = await runNada({ ...base, message: "سقيت لولو اليوم" }, deps(scriptedLlm({ intent: "save_care_log", language: "ar", plant_nickname: "لولو", care_activity: "watering", activity_when: "today" }).llm, data));
    const choice = r.blocks.find((b) => b.type === "action");
    expect(choice?.type === "action" && choice.status).toBe("needs_choice");
  });

  it("Test 7: reports no watering record honestly", async () => {
    const { data } = memoryData([lulu]);
    const { llm, factsOf } = scriptedLlm({ intent: "get_plant_history", language: "ar", plant_nickname: "لولو", care_activity: "watering" });
    await runNada({ ...base, message: "متى آخر مرة سقيت لولو؟" }, deps(llm, data));
    expect(factsOf().no_records).toBe(true);
  });

  it("Test 8: saves a care log, confirms only after success, and returns the updated history", async () => {
    const { data, logs } = memoryData([lulu]);
    const { llm, factsOf } = scriptedLlm({ intent: "save_care_log", language: "ar", plant_nickname: "لولو", care_activity: "watering", activity_when: "today" });
    const r = await runNada({ ...base, message: "سقيت لولو اليوم" }, deps(llm, data));
    expect(logs.get(lulu.id)).toHaveLength(1);
    expect(factsOf().action.status).toBe("success");
    expect(r.blocks.some((b) => b.type === "care_logs" && b.items.length === 1)).toBe(true);
  });

  it("resolves 'the Monstera' to the user's saved plant of that species", async () => {
    const { data } = memoryData([lulu]);
    const { llm, factsOf } = scriptedLlm({ intent: "get_plant_history", language: "ar", species_mentions: ["المونستيرا"], care_activity: "watering" });
    await runNada({ ...base, message: "متى آخر مرة سقيت المونستيرا؟" }, deps(llm, data));
    expect(factsOf().plant).toContain("لولو");
  });

  it("Test 10: saves the exact referenced recommendation to the wishlist", async () => {
    const first = await runNada({ ...base, message: "x" }, deps(scriptedLlm({ intent: "recommend_plant", language: "ar", preferences: { placement: "indoor" } }).llm, null, false));
    const { data, wishlist } = memoryData();
    await runNada({ ...base, message: "احفظي النبتة الثانية في قائمة أمنياتي", context: first.context }, deps(scriptedLlm({ intent: "save_to_wishlist", language: "ar", reference_index: 2 }).llm, data));
    expect(wishlist).toEqual([first.context.last_recommended[1]]);
  });

  it("Test 11: returns an add-to-cart action for the exact first product", async () => {
    const first = await runNada({ ...base, message: "x" }, deps(scriptedLlm({ intent: "recommend_plant", language: "ar", preferences: { light: "full_sun" } }).llm, null, false));
    const r = await runNada({ ...base, message: "ضيفي النبتة الأولى للسلة", context: first.context }, deps(scriptedLlm({ intent: "add_to_cart", language: "ar", reference_index: 1 }).llm, null, false));
    expect(r.clientActions).toEqual([{ type: "add_to_cart", productId: first.context.last_recommended[0] }]);
  });

  it("Test 9: records explored species for signed-in users without marking them owned", async () => {
    const { data, explored } = memoryData();
    await runNada({ ...base, message: "عندي سؤال عن الفيكس ليراتا" }, deps(scriptedLlm({ intent: "general_question", language: "ar", species_mentions: ["Ficus lyrata"] }).llm, data));
    expect(explored.map((e) => e.species_slug)).toEqual(["ficus-lyrata"]);
  });

  it("does not record explored plants when the user turned it off", async () => {
    const { data, explored } = memoryData();
    await runNada({ ...base, message: "x", context: { save_explored: false } }, deps(scriptedLlm({ intent: "general_question", language: "ar", species_mentions: ["Ficus lyrata"] }).llm, data));
    expect(explored).toHaveLength(0);
  });

  it("requires sign-in for personal intents", async () => {
    const r = await runNada({ ...base, message: "كيف حال نباتاتي؟" }, deps(scriptedLlm({ intent: "get_my_plants", language: "ar" }).llm, null, false));
    expect(r.blocks.some((b) => b.type === "action" && b.status === "needs_auth")).toBe(true);
  });

  it("falls back to clarification when the model output is invalid twice", async () => {
    const { llm, calls } = scriptedLlm("not json at all");
    const r = await runNada({ ...base, message: "؟؟" }, deps(llm, null, false));
    expect(r.intent).toBe("clarify_request");
    expect(calls.filter((c) => c.json)).toHaveLength(2);
  });

  it("rejects model output with an unknown intent (no arbitrary actions)", async () => {
    const r = await runNada({ ...base, message: "drop table" }, deps(scriptedLlm({ intent: "execute_sql", language: "en" }).llm, null, false));
    expect(r.intent).toBe("clarify_request");
  });

  it("Test 14: propagates provider failure instead of inventing a reply", async () => {
    const failing: LlamaChat = async () => { throw new Error("provider down"); };
    await expect(runNada({ ...base, message: "hi" }, deps(failing, null, false))).rejects.toThrow("provider down");
  });
});

describe("partial failure", () => {
  it("keeps a saved care log visible when only the reply generation fails", async () => {
    const { data, logs } = memoryData([lulu]);
    let n = 0;
    const llm: LlamaChat = async (_m, opts) => {
      n++;
      if (opts?.json) return JSON.stringify({ intent: "save_care_log", language: "ar", plant_nickname: "لولو", care_activity: "watering", activity_when: "today" });
      throw new Error("generation down");
    };
    const r = await runNada({ ...base, message: "سقيت لولو اليوم" }, deps(llm, data));
    expect(n).toBe(2);
    expect(r.replyError).toBe(true);
    expect(r.reply).toBe("");
    expect(logs.get(lulu.id)).toHaveLength(1);
    expect(r.blocks.some((b) => b.type === "action" && b.status === "success")).toBe(true);
  });
});

describe("provider output handling", () => {
  it("accepts JSON wrapped in prose or code fences (providers without JSON mode)", async () => {
    const wrapped = 'Sure! ```json\n{"intent":"recommend_plant","language":"ar","preferences":{"light":"full_sun"}}\n```';
    const r = await runNada({ ...base, message: "x" }, deps(scriptedLlm(wrapped).llm, null, false));
    expect(r.intent).toBe("recommend_plant");
  });
});

describe("safety backstops", () => {
  it("detects afternoon sun, balcony and pets even if the model misses them", async () => {
    const { detectHardPreferences } = await import("@/lib/ai/nada");
    expect(detectHardPreferences("أبي نبتة لبلكونتي بالرياض والشمس تضربها العصر وعندي قطة", {})).toEqual({ pets: ["cat"], afternoon_sun: true, placement: "balcony" });
    expect(detectHardPreferences("plant for a dim room, I have a dog", {})).toEqual({ pets: ["dog"], light: "low" });
    expect(detectHardPreferences("عندي مونستيرا", {})).toEqual({});
  });

  it("Riyadh balcony with afternoon sun never recommends non-heat-tolerant plants", async () => {
    const llm = scriptedLlm({ intent: "recommend_plant", language: "ar", preferences: { placement: "balcony", city: "الرياض" } }).llm;
    const r = await runNada({ ...base, message: "أبي نبتة لبلكونتي بالرياض والشمس تضربها العصر" }, deps(llm, null, false));
    const block = r.blocks.find((b) => b.type === "products");
    expect(block?.type === "products" && block.items.length).toBeGreaterThan(0);
    if (block?.type === "products") for (const i of block.items) expect(LOCAL_PRODUCTS.find((p) => p.id === i.id)!.species!.heat_tolerant).toBe(true);
  });

  it("removes stray non-Arabic glyphs from a reply after one retry", async () => {
    let n = 0;
    const llm: LlamaChat = async (_m, o) => (o?.json ? JSON.stringify({ intent: "general_question", language: "ar" }) : (n++, "خل顶 التربة تنشف"));
    const r = await runNada({ ...base, message: "x" }, deps(llm, null, false));
    expect(n).toBe(2);
    expect(r.reply).toBe("خل التربة تنشف");
  });
});

describe("action truthfulness guard", () => {
  it("replaces a reply that contradicts a successful database action", async () => {
    const first = await runNada({ ...base, message: "x" }, deps(scriptedLlm({ intent: "recommend_plant", language: "ar", preferences: { placement: "indoor" } }).llm, null, false));
    const { data } = memoryData();
    const liar: LlamaChat = async (_m, o) => (o?.json ? JSON.stringify({ intent: "save_to_wishlist", language: "ar", reference_index: 1 }) : "عفوًا، لم أستطع حفظها.");
    const r = await runNada({ ...base, message: "احفظيها", context: first.context }, deps(liar, data));
    expect(r.reply).not.toMatch(/لم أستطع/);
    expect(r.reply).toContain("حفظت");
  });
});

describe("context leak guard", () => {
  it("never returns a reply that echoes the internal FACTS block", async () => {
    const leaky: LlamaChat = async (_m, o) => (o?.json ? JSON.stringify({ intent: "general_question", language: "ar" }) : 'FACTS (authoritative...): {"intent":"x"}');
    const r = await runNada({ ...base, message: "x" }, deps(leaky, null, false));
    expect(r.reply).not.toMatch(/FACTS/);
  });
});

describe("rescue routing backstop", () => {
  it("routes clear symptoms to the rescue workflow even if the model says 'care'", async () => {
    const { data } = memoryData([lulu]);
    const r = await runNada({ ...base, message: "أوراق لولو صارت صفراء وأسقيها يوميًا" }, deps(scriptedLlm({ intent: "get_plant_care", language: "ar", plant_nickname: "لولو" }).llm, data));
    expect(r.intent).toBe("investigate_plant_problem");
    expect(r.blocks.some((b) => b.type === "checklist" && b.tone === "rescue")).toBe(true);
    expect(r.blocks.some((b) => b.type === "save_observation")).toBe(true);
  });
});

describe("reply language", () => {
  it("uses English when the user writes in English, regardless of the model's guess", async () => {
    const { llm, calls } = scriptedLlm({ intent: "recommend_plant", language: "ar", preferences: { light: "full_sun" } });
    const r = await runNada({ ...base, message: "A plant for my Riyadh balcony with afternoon sun" }, deps(llm, null, false));
    const products = r.blocks.find((b) => b.type === "products");
    expect(products?.type === "products" && products.items[0].name).toMatch(/[A-Za-z]/);
    expect(calls.find((c) => !c.json)!.messages[1].content).toContain("English");
  });
});

describe("ordinal backstop", () => {
  it("adds the exact first product even if the model omits reference_index", async () => {
    const first = await runNada({ ...base, message: "x" }, deps(scriptedLlm({ intent: "recommend_plant", language: "ar", preferences: { light: "full_sun" } }).llm, null, false));
    const r = await runNada({ ...base, message: "ضيفي النبتة الأولى للسلة", context: { ...first.context, focus_species: "aloe-vera" } }, deps(scriptedLlm({ intent: "add_to_cart", language: "ar", species_mentions: [] }).llm, null, false));
    expect(r.clientActions).toEqual([{ type: "add_to_cart", productId: first.context.last_recommended[0] }]);
  });
});

describe("no false care records", () => {
  it("does not log watering for a habit description", async () => {
    const { data, logs } = memoryData([lulu]);
    const r = await runNada({ ...base, message: "أوراق لولو صارت صفراء وأسقيها يوميًا" }, deps(scriptedLlm({ intent: "save_care_log", language: "ar", plant_nickname: "لولو", care_activity: "watering" }).llm, data));
    expect(logs.get(lulu.id) ?? []).toHaveLength(0);
    expect(r.intent).toBe("investigate_plant_problem");
  });
  it("still logs a completed action", async () => {
    const { data, logs } = memoryData([lulu]);
    await runNada({ ...base, message: "سقيت لولو أمس" }, deps(scriptedLlm({ intent: "save_care_log", language: "ar", plant_nickname: "لولو", care_activity: "watering", activity_when: "yesterday" }).llm, data));
    expect(logs.get(lulu.id)).toHaveLength(1);
  });
});

describe("script allowlist", () => {
  it("flags kana, CJK, Cyrillic and Vietnamese in Arabic replies but allows Latin plant names", async () => {
    const { hasStrayScript } = await import("@/lib/ai/nada");
    for (const bad of ["غابة الجングル", "تدع顶", "داخل giống", "привет"]) expect(hasStrayScript(bad, "ar"), bad).toBe(true);
    for (const ok of ["مونستيرا Monstera deliciosa 🌿 ✓ ٥ سم", "Nada AI"]) expect(hasStrayScript(ok, "ar"), ok).toBe(false);
    expect(hasStrayScript("café is fine in English", "en")).toBe(false);
  });
});

describe("customer-data integration", () => {
  it("'how are my plants' includes record-based insights and status flags", async () => {
    const { data } = memoryData([lulu, { ...lulu, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", nickname: "صبورة", species_slug: "aloe-vera", light_condition: "low" }]);
    await data.addCareLog(lulu.id, "watering", "2026-10-20T09:00:00Z", null);
    const { llm, factsOf } = scriptedLlm({ intent: "get_my_plants", language: "ar" });
    const r = await runNada({ ...base, message: "ندى، كيف حال نباتاتي؟" }, deps(llm, data));
    const f = factsOf();
    expect(f.user_plants[0].record_based_insights.days_since_recorded_watering).toBe(13);
    expect(f.user_plants[0].record_based_insights.soil_check_due).toBe(true);
    const cards = r.blocks.find((b) => b.type === "user_plants");
    expect(cards?.type === "user_plants" && cards.items.find((c) => c.title.includes("لولو"))!.flags).toContain("soil_check_due");
    expect(cards?.type === "user_plants" && cards.items.find((c) => c.title.includes("صبورة"))!.flags).toEqual(expect.arrayContaining(["light_mismatch", "no_watering_recorded"]));
  });
});
