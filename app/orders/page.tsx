import Link from "next/link";
import { redirect } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { formatDate, formatSAR } from "@/lib/i18n/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { t, locale } = await getDict();
  if (!isSupabaseConfigured()) return <div className="container-x py-14"><p className="card mx-auto max-w-lg p-6 text-sm text-warn">{t.auth.notConfigured}</p></div>;
  const user = await getUser();
  if (!user) redirect("/account/login?next=/orders");
  const supabase = (await getSupabase())!;
  const { data: orders } = await supabase.from("orders").select("id, order_number, total_sar, status, created_at, order_items(quantity)").eq("user_id", user.id).order("created_at", { ascending: false });
  return (
    <div className="container-x py-10">
      <h1 className="mb-6 text-3xl font-bold text-deep">{t.orders.title}</h1>
      {!orders?.length ? <p className="card p-10 text-center text-muted">{t.orders.empty}</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-soft text-deep"><tr>{[t.checkout.orderNumber, t.orders.date, t.orders.items, t.cart.total, t.orders.status, ""].map((h, i) => <th key={i} className="px-4 py-3 text-start font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono" dir="ltr">{o.order_number}</td>
                  <td className="px-4 py-3">{formatDate(o.created_at, locale)}</td>
                  <td className="px-4 py-3">{o.order_items.reduce((a: number, i: { quantity: number }) => a + i.quantity, 0)}</td>
                  <td className="px-4 py-3 font-semibold">{formatSAR(Number(o.total_sar), locale)}</td>
                  <td className="px-4 py-3"><span className="demo-badge">{t.orders.confirmed}</span></td>
                  <td className="px-4 py-3"><Link href={`/orders/${o.id}`} className="text-saudi hover:underline">{t.orders.view}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
