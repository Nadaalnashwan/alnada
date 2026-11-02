// Executes the real migration + seed in PGlite (in-process Postgres) and verifies
// authorisation boundaries, checkout integrity and My Green Space idempotency.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";

let db: PGlite;

/** Runs fn as an API role with the given JWT subject, inside a rolled-back-on-error transaction. */
async function as<T>(uid: string | null, fn: (tx: PGlite) => Promise<T>): Promise<T> {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try {
    return await fn(db);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}

const one = async (sql: string, params: unknown[] = []) => (await db.query<Record<string, any>>(sql, params)).rows[0];
const productId = async (sku: string) => (await one("select id from public.products where sku = $1", [sku])).id as string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("tests/db/supabase-stubs.sql", "utf8"));
  for (const f of readdirSync("supabase/migrations").sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  await db.exec(readFileSync("supabase/seed/seed.sql", "utf8"));
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@test.local'), ('${B}', 'b@test.local'), ('${ADMIN}', 'admin@test.local');
                 update public.profiles set role = 'admin' where id = '${ADMIN}';`);
}, 60_000);

describe("seed", () => {
  it("loads the catalogue with category relationships", async () => {
    expect(Number((await one("select count(*) c from public.products")).c)).toBe(76);
    expect(Number((await one("select count(*) c from public.plant_species")).c)).toBe(50);
    const empty = await db.query("select c.slug from public.categories c left join public.product_categories pc on pc.category_id = c.id group by c.slug having count(pc.product_id) = 0");
    expect(empty.rows).toEqual([]);
  });

  it("creates a customer profile for each new auth user", async () => {
    expect((await one(`select role from public.profiles where id = '${A}'`)).role).toBe("customer");
  });
});

describe("public vs private access", () => {
  it("lets visitors read the catalogue but not private data", async () => {
    await as(null, async () => {
      expect(Number((await one("select count(*) c from public.products")).c)).toBe(76);
    });
    // visitors have no privilege on private tables at all (stronger than RLS returning zero rows)
    await expect(as(null, () => db.query("select count(*) from public.user_plants"))).rejects.toThrow(/permission denied/);
    await expect(as(null, () => db.query("insert into public.wishlists (user_id, product_id) values ($1, $2)", [A, crypto.randomUUID()]))).rejects.toThrow();
  });

  it("isolates two customers' plants, care logs, wishlists and chats", async () => {
    const monstera = await one("select id from public.plant_species where slug = 'monstera-deliciosa'");
    const plant = await as(A, async () => {
      const p = await one("insert into public.user_plants (user_id, species_id, nickname, source) values ($1, $2, 'لولو', 'manual') returning id", [A, monstera.id]);
      await db.query("insert into public.care_logs (user_id, user_plant_id, activity) values ($1, $2, 'watering')", [A, p.id]);
      await db.query("insert into public.wishlists (user_id, product_id) values ($1, $2)", [A, await productId("PL-MON-DEL-M")]);
      const s = await one("insert into public.chat_sessions (user_id, workflow) values ($1, 'care') returning id", [A]);
      await db.query("insert into public.chat_messages (session_id, user_id, role, content) values ($1, $2, 'user', 'hi')", [s.id, A]);
      return p;
    });

    await as(B, async () => {
      for (const t of ["user_plants", "care_logs", "wishlists", "chat_sessions", "chat_messages"]) {
        expect(Number((await one(`select count(*) c from public.${t}`)).c), t).toBe(0);
      }
      // B cannot attach a care log to A's plant, even claiming their own user_id
      await expect(db.query("insert into public.care_logs (user_id, user_plant_id, activity) values ($1, $2, 'watering')", [B, plant.id])).rejects.toThrow();
      // nor write rows on A's behalf
      await expect(db.query("insert into public.user_plants (user_id, unconfirmed_label, source) values ($1, 'x', 'manual')", [A])).rejects.toThrow();
      // updates to A's rows silently affect nothing
      const upd = await db.query("update public.user_plants set nickname = 'hacked' where id = $1", [plant.id]);
      expect(upd.affectedRows).toBe(0);
    });

    await as(A, async () => {
      expect(Number((await one("select count(*) c from public.user_plants")).c)).toBe(1);
      expect(Number((await one("select count(*) c from public.care_logs")).c)).toBe(1);
    });
  });

  it("prevents customers from making themselves admin", async () => {
    await expect(as(A, () => db.query(`update public.profiles set role = 'admin' where id = '${A}'`))).rejects.toThrow();
    await as(A, async () => {
      await db.query(`update public.profiles set full_name = 'Nada' where id = '${A}'`);
      expect((await one(`select role, full_name from public.profiles where id = '${A}'`)).role).toBe("customer");
    });
  });

  it("only admins can change products or read store analytics", async () => {
    const id = await productId("PL-ALO-VER-S");
    await as(A, async () => {
      const r = await db.query("update public.products set price_sar = 1 where id = $1", [id]);
      expect(r.affectedRows).toBe(0);
    });
    await expect(as(A, () => db.query("select public.admin_store_stats()"))).rejects.toThrow(/FORBIDDEN/);
    await as(ADMIN, async () => {
      const r = await db.query("update public.products set stock = stock where id = $1", [id]);
      expect(r.affectedRows).toBe(1);
      const stats = (await one("select public.admin_store_stats() s")).s;
      expect(stats).toHaveProperty("orders");
    });
  });
});

describe("demo checkout", () => {
  it("uses database prices, decrements stock and clears the cart", async () => {
    const aloe = await productId("PL-ALO-VER-S"); // 39 SAR
    const pot = await productId("PT-TER-12"); // 19 SAR
    const before = Number((await one("select stock from public.products where id = $1", [aloe])).stock);
    const order = await as(A, async () => {
      const cart = await one("insert into public.carts (user_id) values ($1) returning id", [A]);
      await db.query("insert into public.cart_items (cart_id, product_id, quantity) values ($1, $2, 2)", [cart.id, aloe]);
      // a tampered client "price" field is ignored entirely
      const items = JSON.stringify([{ product_id: aloe, quantity: 2, price: 0.01 }, { product_id: pot, quantity: 1 }]);
      const o = await one("select * from public.place_demo_order($1::jsonb, '{\"name\":\"Nada\",\"city\":\"Riyadh\"}')", [items]);
      expect(Number((await one("select count(*) c from public.cart_items")).c)).toBe(0);
      return o;
    });
    expect(Number(order.subtotal_sar)).toBe(97);
    expect(Number(order.shipping_sar)).toBe(25);
    expect(Number(order.total_sar)).toBe(122);
    expect(Number((await one("select stock from public.products where id = $1", [aloe])).stock)).toBe(before - 2);
  });

  it("rejects invalid quantities, oversold stock and anonymous checkout", async () => {
    const aloe = await productId("PL-ALO-VER-S");
    await expect(as(A, () => db.query("select public.place_demo_order($1::jsonb)", [JSON.stringify([{ product_id: aloe, quantity: 0 }])]))).rejects.toThrow(/INVALID_QUANTITY/);
    await expect(as(A, () => db.query("select public.place_demo_order($1::jsonb)", [JSON.stringify([{ product_id: aloe, quantity: 21 }])]))).rejects.toThrow(/INVALID_QUANTITY/);
    const rare = await productId("PL-PHO-ROE-L"); // stock 6
    await expect(as(A, () => db.query("select public.place_demo_order($1::jsonb)", [JSON.stringify([{ product_id: rare, quantity: 7 }])]))).rejects.toThrow(/INSUFFICIENT_STOCK/);
    await expect(as(null, () => db.query("select public.place_demo_order($1::jsonb)", [JSON.stringify([{ product_id: aloe, quantity: 1 }])]))).rejects.toThrow();
  });

  it("adds purchased plants to My Green Space once per physical unit, idempotently", async () => {
    const order = await as(A, () => one("select id from public.orders order by created_at desc limit 1"));
    const first = await as(A, () => one("select public.add_order_plants_to_space($1) n", [order.id]));
    expect(first.n).toBe(2); // two aloe units; the pot is not a plant
    const again = await as(A, () => one("select public.add_order_plants_to_space($1) n", [order.id]));
    expect(again.n).toBe(0);
    await as(A, async () => {
      const rows = await db.query<{ source: string }>("select source from public.user_plants where order_item_id is not null");
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows.every((r) => r.source === "store_purchase")).toBe(true);
    });
    // another customer cannot claim A's order
    await expect(as(B, () => db.query("select public.add_order_plants_to_space($1)", [order.id]))).rejects.toThrow(/ORDER_NOT_FOUND/);
  });
});

describe("storage policies", () => {
  it("lets users write plant photos only inside their own folder", async () => {
    await as(A, () => db.query("insert into storage.objects (bucket_id, name) values ('plant-photos', $1)", [`${A}/lulu.jpg`]));
    await expect(as(A, () => db.query("insert into storage.objects (bucket_id, name) values ('plant-photos', $1)", [`${B}/x.jpg`]))).rejects.toThrow();
    await as(B, async () => {
      expect(Number((await one("select count(*) c from storage.objects where bucket_id = 'plant-photos'")).c)).toBe(0);
    });
  });
});

describe("advisor hardening", () => {
  it("trigger function is not callable via the API", async () => {
    await expect(as(A, () => db.query("select public.handle_new_user()"))).rejects.toThrow();
  });
  it("customers still cannot write the catalogue after the policy split", async () => {
    await as(A, async () => {
      const r = await db.query("update public.categories set sort = 99 where slug = 'indoor'");
      expect(r.affectedRows).toBe(0);
    });
    await expect(as(A, () => db.query("insert into public.categories (slug, name_en, name_ar) values ('x','x','x')"))).rejects.toThrow();
  });
});

describe("explicit API grants", () => {
  it("API roles cannot TRUNCATE (which would bypass RLS)", async () => {
    await expect(as(A, () => db.query("truncate public.care_logs"))).rejects.toThrow();
    await expect(as(null, () => db.query("truncate public.products"))).rejects.toThrow();
  });
  it("visitors cannot write customer tables at the privilege level", async () => {
    await expect(as(null, () => db.query("select * from public.user_plants"))).rejects.toThrow();
  });
});
