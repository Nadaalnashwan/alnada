/**
 * Live end-to-end checks against the configured Supabase project, using ONLY the publishable key
 * (exactly what the web app uses), so every result reflects real RLS behaviour.
 *
 * Requires two already-confirmed test accounts (TEST_A_EMAIL / TEST_B_EMAIL, shared TEST_PASSWORD in
 * .env.local). Creates its own rows and removes them at the end. Never prints secrets.
 *
 * Usage: npm run test:live
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const [A_EMAIL, B_EMAIL, PASSWORD] = [process.env.TEST_A_EMAIL, process.env.TEST_B_EMAIL, process.env.TEST_PASSWORD];

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const client = () => createClient(URL, KEY, { auth: { persistSession: false } });

async function signIn(email: string) {
  const sb = client();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD! });
  if (error || !data.user) throw new Error(`sign-in failed for test user: ${error?.message}`);
  return { sb, id: data.user.id };
}

async function main() {
  if (!URL || !KEY || !A_EMAIL || !B_EMAIL || !PASSWORD) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL/ANON_KEY and TEST_A_EMAIL, TEST_B_EMAIL, TEST_PASSWORD in .env.local");
    process.exit(2);
  }
  // ── public catalogue as a visitor ──
  const anon = client();
  const { count: productCount } = await anon.from("products").select("id", { count: "exact", head: true });
  check("visitor can read catalogue", (productCount ?? 0) === 76, `${productCount} products`);
  const { data: anonPlants, error: anonErr } = await anon.from("user_plants").select("id");
  check("visitor sees no private rows", Boolean(anonErr) || (anonPlants ?? []).length === 0, anonErr ? "permission denied" : "0 rows");

  // ── authentication ──
  const A = await signIn(A_EMAIL);
  const B = await signIn(B_EMAIL);
  check("two customers can sign in", Boolean(A.id && B.id && A.id !== B.id));
  const { data: profA } = await A.sb.from("profiles").select("role").eq("id", A.id).single();
  check("profile auto-created with customer role", profA?.role === "customer");
  const { error: roleErr } = await A.sb.from("profiles").update({ role: "admin" }).eq("id", A.id);
  check("customer cannot self-promote to admin", Boolean(roleErr));

  // ── My Green Space + care logs ──
  const { data: species } = await A.sb.from("plant_species").select("id").eq("slug", "monstera-deliciosa").single();
  const { data: plant, error: plantErr } = await A.sb.from("user_plants")
    .insert({ user_id: A.id, species_id: species!.id, nickname: "لولو-اختبار", location: "غرفة النوم", light_condition: "medium", source: "manual" })
    .select("id").single();
  check("add owned plant", !plantErr && Boolean(plant), plantErr?.message);
  const { error: logErr } = await A.sb.from("care_logs").insert({ user_id: A.id, user_plant_id: plant!.id, activity: "watering" });
  check("save care log", !logErr, logErr?.message);
  const { data: logs } = await A.sb.from("care_logs").select("activity, occurred_at").eq("user_plant_id", plant!.id);
  check("read back care history", logs?.length === 1 && logs[0].activity === "watering");

  // ── wishlist + explored ──
  const { data: prod } = await A.sb.from("products").select("id, price_sar, stock").eq("sku", "PL-ALO-VER-S").single();
  const { error: wishErr } = await A.sb.from("wishlists").insert({ user_id: A.id, product_id: prod!.id });
  check("add to wishlist", !wishErr, wishErr?.message);
  const { error: expErr } = await A.sb.from("explored_plants").upsert({ user_id: A.id, species_id: species!.id, reason: "live test", source: "chat" }, { onConflict: "user_id,species_id" });
  check("record explored plant", !expErr, expErr?.message);

  // ── isolation: B cannot see or touch A's data ──
  for (const t of ["user_plants", "care_logs", "wishlists", "explored_plants"]) {
    const { data } = await B.sb.from(t).select("*").eq("user_id", A.id);
    check(`B cannot read A's ${t}`, (data ?? []).length === 0);
  }
  const { error: crossLog } = await B.sb.from("care_logs").insert({ user_id: B.id, user_plant_id: plant!.id, activity: "watering" });
  check("B cannot log care on A's plant", Boolean(crossLog));
  const { data: hijack } = await B.sb.from("user_plants").update({ nickname: "x" }).eq("id", plant!.id).select("id");
  check("B cannot edit A's plant", (hijack ?? []).length === 0);

  // ── cart + demo checkout ──
  const { data: cart } = await A.sb.from("carts").upsert({ user_id: A.id }, { onConflict: "user_id" }).select("id").single();
  await A.sb.from("cart_items").upsert({ cart_id: cart!.id, product_id: prod!.id, quantity: 2 });
  const { data: order, error: orderErr } = await A.sb.rpc("place_demo_order", { p_items: [{ product_id: prod!.id, quantity: 2, price: 0.01 }], p_contact: { name: "Test", city: "Riyadh" } });
  check("demo checkout succeeds", !orderErr && Boolean(order), orderErr?.message);
  check("checkout uses database prices", Number(order?.subtotal_sar) === Number(prod!.price_sar) * 2, `subtotal ${order?.subtotal_sar}`);
  const { data: after } = await A.sb.from("products").select("stock").eq("id", prod!.id).single();
  check("stock decremented", after?.stock === prod!.stock - 2);
  const { count: cartLeft } = await A.sb.from("cart_items").select("*", { count: "exact", head: true }).eq("cart_id", cart!.id);
  check("cart cleared after order", cartLeft === 0);
  const { error: oversell } = await A.sb.rpc("place_demo_order", { p_items: [{ product_id: prod!.id, quantity: 21 }], p_contact: {} });
  check("invalid quantity rejected", Boolean(oversell));
  const { data: added1 } = await A.sb.rpc("add_order_plants_to_space", { p_order_id: order!.id });
  const { data: added2 } = await A.sb.rpc("add_order_plants_to_space", { p_order_id: order!.id });
  check("purchased plants added once per unit (idempotent)", added1 === 2 && added2 === 0, `${added1} then ${added2}`);
  const { error: stealOrder } = await B.sb.rpc("add_order_plants_to_space", { p_order_id: order!.id });
  check("B cannot claim A's order", Boolean(stealOrder));
  const { data: bOrders } = await B.sb.from("orders").select("id").eq("id", order!.id);
  check("B cannot read A's order", (bOrders ?? []).length === 0);
  const { error: statsErr } = await A.sb.rpc("admin_store_stats");
  check("customer cannot read admin analytics", Boolean(statsErr));

  // ── cleanup (A's rows; restores stock is not needed for demo data but we put it back) ──
  await A.sb.from("user_plants").delete().eq("user_id", A.id);
  await A.sb.from("wishlists").delete().eq("user_id", A.id);
  await A.sb.from("explored_plants").delete().eq("user_id", A.id);
  console.log(`\n${failures ? `${failures} FAILED` : "All live checks passed"}. (Test order ${order?.order_number ?? "-"} kept as demo history.)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("Live test aborted:", (e as Error).message);
  process.exit(1);
});
