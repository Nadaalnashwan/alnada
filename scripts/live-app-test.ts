/**
 * Live end-to-end test of the running app (npm run dev) through its real API routes:
 * Supabase Auth session cookies (@supabase/ssr), Nada AI with real Meta Llama, My Green Space,
 * care logs, wishlist, cart and demo checkout. Uses the TEST_* accounts from .env.local.
 * Prints intents, block types and short reply excerpts — never secrets or tokens.
 *
 * Usage: APP_URL=http://localhost:3000 npm run test:app
 */
import { config } from "dotenv";
import { createServerClient } from "@supabase/ssr";
import type { ChatResponse } from "../lib/ai/schemas";

config({ path: ".env.local", quiet: true });
const APP = process.env.APP_URL ?? "http://localhost:3000";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Signs in exactly like the browser does and returns the auth cookie header + a client. */
async function session(email: string) {
  const jar = new Map<string, string>();
  const sb = createServerClient(SB_URL, SB_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password: process.env.TEST_PASSWORD! });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return { sb, userId: data.user!.id, cookie: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
}

type Ctx = { sessionId: string | null; context: ChatResponse["context"] | null; history: { role: "user" | "assistant"; content: string }[] };

async function chat(cookie: string | null, ctx: Ctx, message: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${APP}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ message, sessionId: ctx.sessionId, context: ctx.context, history: ctx.history, ...extra }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`chat HTTP ${res.status} ${body.error}`);
  const r = body as ChatResponse;
  ctx.sessionId = r.sessionId;
  ctx.context = r.context;
  ctx.history.push({ role: "user", content: message }, { role: "assistant", content: r.reply });
  console.log(`\n» ${message}\n  intent=${r.intent} blocks=[${r.blocks.map((b) => b.type + ("status" in b ? `:${b.status}` : "")).join(", ")}]${r.replyError ? " REPLY_ERROR" : ""}`);
  console.log(`  ندى: ${r.reply.replace(/\s+/g, " ").slice(0, 260)}${r.reply.length > 260 ? "…" : ""}`);
  return r;
}

const api = (cookie: string, path: string, method: string, body?: unknown) =>
  fetch(`${APP}${path}`, { method, headers: { "Content-Type": "application/json", Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });

async function main() {
  // ── Guest: Test 1 (recommendations with pet safety) ──
  const guest: Ctx = { sessionId: null, context: null, history: [] };
  const t1 = await chat(null, guest, "أبي نبتة لغرفتي وإضاءتها ضعيفة وعندي قطة");
  const products1 = t1.blocks.find((b) => b.type === "products");
  check("T1 recommends catalogue products with images", t1.intent === "recommend_plant" && products1?.type === "products" && products1.items.length > 0 && products1.items.every((i) => i.image));
  check("T1 guest chat is not persisted", t1.sessionId === null);

  // ── Signed-in customer A ──
  const A = await session(process.env.TEST_A_EMAIL!);
  const cookie = A.cookie();
  await A.sb.from("user_plants").delete().eq("user_id", A.userId); // clean slate for this test user
  const created = await api(cookie, "/api/user-plants", "POST", { speciesSlug: "monstera-deliciosa", nickname: "لولو", location: "غرفة النوم", light_condition: "medium" });
  const { id: luluId } = await created.json();
  check("T5 save a plant to My Green Space via API", created.ok && Boolean(luluId));

  const ctx: Ctx = { sessionId: null, context: null, history: [] };
  const t6 = await chat(cookie, ctx, "كيف أعتني بلولو؟");
  check("T6 personal care resolves 'لولو'", t6.intent === "get_plant_care" && t6.context.focus_user_plant === luluId);
  check("T6 chat session saved for signed-in user", Boolean(t6.sessionId));

  const t7a = await chat(cookie, ctx, "متى آخر مرة سقيت لولو؟");
  const logs7a = t7a.blocks.find((b) => b.type === "care_logs");
  check("T7 no watering recorded yet → empty history", t7a.intent === "get_plant_history" && logs7a?.type === "care_logs" && logs7a.items.length === 0);

  const t8 = await chat(cookie, ctx, "سقيت لولو اليوم");
  const act8 = t8.blocks.find((b) => b.type === "action");
  const { count: waterings } = await A.sb.from("care_logs").select("*", { count: "exact", head: true }).eq("user_plant_id", luluId).eq("activity", "watering");
  check("T8 care log saved and confirmed only after DB success", t8.intent === "save_care_log" && act8?.type === "action" && act8.status === "success" && waterings === 1);

  const t7b = await chat(cookie, ctx, "متى آخر مرة سقيت لولو؟");
  const logs7b = t7b.blocks.find((b) => b.type === "care_logs");
  check("T7 returns the actual latest watering", logs7b?.type === "care_logs" && logs7b.items.length === 1);

  const t4 = await chat(cookie, ctx, "أوراق لولو صارت صفراء وأسقيها يوميًا");
  check("T4 rescue: checklist + offer to save observation", t4.intent === "investigate_plant_problem" && t4.blocks.some((b) => b.type === "checklist" && b.tone === "rescue"));

  const mine = await chat(cookie, ctx, "ندى، كيف حال نباتاتي؟");
  check("Example 1: shows the user's actual plant cards", mine.intent === "get_my_plants" && mine.blocks.some((b) => b.type === "user_plants" && b.items.some((i) => i.id === luluId)));

  // ── Finder in a fresh conversation: Test 2, cheaper, wishlist, cart ──
  const f: Ctx = { sessionId: null, context: null, history: [] };
  const t2 = await chat(cookie, f, "أبي نبتة لبلكونتي بالرياض والشمس تضربها العصر");
  const p2 = t2.blocks.find((b) => b.type === "products");
  check("T2 Riyadh balcony → heat-tolerant picks", t2.intent === "recommend_plant" && p2?.type === "products" && p2.items.length > 0 && p2.items.every((i) => i.reasons.some((r) => r.includes("حرارة"))));
  const firstMin = p2?.type === "products" ? Math.min(...p2.items.map((i) => i.price)) : 0;
  const cheaper = await chat(cookie, f, "وريني خيارات أرخص");
  const pc = cheaper.blocks.find((b) => b.type === "products");
  check("cheaper options keep conditions & lower prices", cheaper.context.preferences.placement === "balcony" && (pc?.type !== "products" || pc.items.every((i) => i.price < firstMin)));
  const second = f.context!.last_recommended[1];
  await A.sb.from("wishlists").delete().eq("user_id", A.userId);
  const t10 = await chat(cookie, f, "احفظي النبتة الثانية في قائمة أمنياتي");
  const { data: wl } = await A.sb.from("wishlists").select("product_id");
  check("T10 exact 2nd product saved to wishlist", t10.intent === "save_to_wishlist" && Boolean(second) && (wl ?? []).some((w) => w.product_id === second));
  const firstId = f.context!.last_recommended[0];
  const t11 = await chat(cookie, f, "ضيفي النبتة الأولى للسلة");
  check("T11 add exact 1st product to cart", t11.intent === "add_to_cart" && t11.clientActions.some((a) => a.productId === firstId));

  const t9 = await chat(cookie, f, "وريني النباتات اللي سألتك عنها الأسبوع اللي فات");
  check("Example 4: explored history from the database", t9.intent === "get_explored_history" && t9.blocks.some((b) => b.type === "products"));

  // ── Cart sync + checkout through the app routes (Test 12) ──
  const put = await api(cookie, "/api/cart", "PUT", { lines: [{ productId: firstId, qty: 1 }] });
  const got = await (await api(cookie, "/api/cart", "GET")).json();
  check("cart saved to account", put.ok && got.lines?.[0]?.productId === firstId);
  const co = await api(cookie, "/api/checkout", "POST", { items: [{ product_id: firstId, quantity: 1 }], contact: { name: "Test", city: "الرياض" } });
  const order = (await co.json()).order;
  check("T12 demo checkout via app route", co.ok && Boolean(order?.id), order?.order_number);
  const add = await (await api(cookie, `/api/orders/${order?.id}/add-to-space`, "POST")).json();
  check("T12 purchased plant added to My Green Space", add.added >= 1, `added ${add.added}`);

  // ── Test 13: another customer cannot use A's ids through the app ──
  const B = await session(process.env.TEST_B_EMAIL!);
  const steal = await api(B.cookie(), "/api/care-logs", "POST", { plantId: luluId, activity: "watering" });
  check("T13 B cannot log care on A's plant via API", !steal.ok);
  const peek = await api(B.cookie(), `/api/orders/${order?.id}/add-to-space`, "POST");
  check("T13 B cannot claim A's order via API", !peek.ok);

  // cleanup test-user data (orders kept as demo history)
  await A.sb.from("user_plants").delete().eq("user_id", A.userId);
  await A.sb.from("wishlists").delete().eq("user_id", A.userId);
  await A.sb.from("explored_plants").delete().eq("user_id", A.userId);
  await A.sb.from("chat_sessions").delete().eq("user_id", A.userId);
  console.log(`\n${failures ? `${failures} FAILED` : "All app checks passed"}.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("App test aborted:", (e as Error).message);
  process.exit(1);
});
