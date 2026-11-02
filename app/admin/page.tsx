import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductRow } from "@/components/admin/ProductRow";
import { getDict } from "@/lib/i18n/server";
import { formatDate, formatSAR } from "@/lib/i18n/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

type Stats = {
  orders: number; revenue_sar: number; customers: number; owned_plants: number; recommendations: number; low_stock: number; pet_safe_requests: number;
  top_products: { name_ar: string; name_en: string; units: number }[]; top_categories: { name_ar: string; name_en: string; units: number }[];
  recommended_products: { name_ar: string; name_en: string; times: number }[];
};

export default async function AdminPage() {
  const { t, locale } = await getDict();
  if (!isSupabaseConfigured()) return <div className="container-x py-14"><p className="card p-6 text-sm text-warn">{t.auth.notConfigured}</p></div>;
  const user = await getUser();
  if (!user) redirect("/account/login?next=/admin");
  if (!user.isAdmin) return <div className="container-x py-20"><p className="card mx-auto max-w-md p-8 text-center text-danger">{t.admin.forbidden}</p></div>;

  const supabase = (await getSupabase())!;
  const [{ data: stats }, { data: products }, { data: orders }] = await Promise.all([
    supabase.rpc("admin_store_stats"),
    supabase.from("products").select("id, sku, name_ar, name_en, kind, price_sar, stock, is_active, image").order("sku"),
    supabase.from("orders").select("order_number, total_sar, created_at, contact, order_items(quantity)").order("created_at", { ascending: false }).limit(15),
  ]);
  const s = stats as Stats | null;
  const n = (x: { name_ar: string; name_en: string }) => (locale === "ar" ? x.name_ar : x.name_en);
  const kpis = s ? [
    { label: t.admin.orders, value: s.orders }, { label: t.admin.revenue, value: formatSAR(Number(s.revenue_sar), locale) }, { label: t.admin.customers, value: s.customers },
    { label: t.admin.ownedPlants, value: s.owned_plants }, { label: t.admin.recs, value: s.recommendations }, { label: t.admin.lowStock, value: s.low_stock },
  ] : [];

  return (
    <div className="container-x space-y-8 py-10">
      <h1 className="text-3xl font-bold text-deep">{t.admin.title} <span className="demo-badge align-middle">{t.common.demo}</span></h1>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => <div key={k.label} className="card p-4"><p className="text-xs text-muted">{k.label}</p><p className="mt-1 text-2xl font-bold text-saudi">{k.value}</p></div>)}
      </section>
      {s && (
        <section className="grid gap-4 md:grid-cols-3">
          {[{ title: t.admin.topProducts, rows: s.top_products.map((x) => [n(x), x.units]) }, { title: t.admin.topCategories, rows: s.top_categories.map((x) => [n(x), x.units]) }, { title: t.admin.topRecommended, rows: s.recommended_products.map((x) => [n(x), x.times]) }].map((b) => (
            <div key={b.title} className="card p-4">
              <h2 className="mb-3 font-semibold text-deep">{b.title}</h2>
              {b.rows.length ? <ol className="space-y-2 text-sm">{b.rows.map(([name, v], i) => {
                const max = Number(b.rows[0][1]) || 1;
                return <li key={i}><div className="flex justify-between"><span>{name}</span><span className="font-semibold">{v}</span></div><div className="mt-1 h-1.5 rounded-full bg-soft"><div className="h-full rounded-full bg-saudi" style={{ width: `${(Number(v) / max) * 100}%` }} /></div></li>;
              })}</ol> : <p className="text-sm text-muted">—</p>}
            </div>
          ))}
        </section>
      )}
      <section className="card overflow-x-auto">
        <h2 className="p-4 font-semibold text-deep">{t.admin.orders}</h2>
        <table className="w-full text-sm">
          <tbody>{(orders ?? []).map((o) => (
            <tr key={o.order_number} className="border-t border-line">
              <td className="px-4 py-2 font-mono" dir="ltr">{o.order_number}</td><td className="px-4 py-2">{formatDate(o.created_at, locale)}</td>
              <td className="px-4 py-2">{(o.contact as { city?: string })?.city ?? "—"}</td>
              <td className="px-4 py-2">{o.order_items.reduce((a: number, i: { quantity: number }) => a + i.quantity, 0)}</td>
              <td className="px-4 py-2 font-semibold">{formatSAR(Number(o.total_sar), locale)}</td>
            </tr>))}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="p-4 font-semibold text-deep">{t.admin.products} ({products?.length ?? 0})</h2>
        <table className="w-full text-sm"><tbody>
          {(products ?? []).map((p) => <ProductRow key={p.id} p={{ id: p.id, sku: p.sku, name: locale === "ar" ? p.name_ar : p.name_en, kind: p.kind, price: Number(p.price_sar), stock: p.stock, active: p.is_active, image: (p.image as { url?: string } | null)?.url ?? null }} />)}
        </tbody></table>
      </section>
    </div>
  );
}
