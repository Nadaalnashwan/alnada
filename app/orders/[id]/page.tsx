import { notFound, redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { AddToSpaceButton } from "@/components/cart/AddToSpaceButton";
import { PlantImage } from "@/components/store/PlantImage";
import { getAllProducts } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";
import { formatDate, formatSAR } from "@/lib/i18n/format";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  const { t, locale } = await getDict();
  const user = await getUser();
  if (!user) redirect(`/account/login?next=/orders/${id}`);
  const supabase = (await getSupabase())!;
  const { data: order } = await supabase.from("orders").select("id, order_number, subtotal_sar, shipping_sar, total_sar, created_at, contact, order_items(id, product_id, species_id, name_snapshot, unit_price_sar, quantity)").eq("id", id).maybeSingle();
  if (!order) notFound(); // RLS: other customers' orders are invisible
  const products = await getAllProducts();
  const items = order.order_items as { id: string; product_id: string; species_id: string | null; name_snapshot: string; unit_price_sar: number; quantity: number }[];
  const plantItems = items.filter((i) => i.species_id);
  const { count } = await supabase.from("user_plants").select("id", { count: "exact", head: true }).in("order_item_id", items.map((i) => i.id));
  const plantUnits = plantItems.reduce((a, i) => a + i.quantity, 0);

  return (
    <div className="container-x max-w-3xl py-10">
      {isNew && <p className="mb-6 flex items-center gap-2 rounded-2xl bg-soft p-4 font-semibold text-saudi"><CheckCircle2 className="size-5" />{t.checkout.success}</p>}
      <div className="card space-y-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-deep">{t.checkout.orderNumber}: <span className="font-mono" dir="ltr">{order.order_number}</span></h1>
          <span className="demo-badge">{t.orders.confirmed}</span>
        </div>
        <p className="text-sm text-muted">{formatDate(order.created_at, locale)}</p>
        <ul className="divide-y divide-line">
          {items.map((i) => {
            const p = products.find((x) => x.id === i.product_id);
            return (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-soft"><PlantImage src={p?.image?.thumb_url ?? null} alt="" sizes="56px" /></div>
                <span className="flex-1 text-sm">{p ? (locale === "ar" ? p.name_ar : p.name_en) : i.name_snapshot} × {i.quantity}</span>
                <span className="text-sm font-semibold">{formatSAR(Number(i.unit_price_sar) * i.quantity, locale)}</span>
              </li>
            );
          })}
        </ul>
        <div className="space-y-1 border-t border-line pt-4 text-sm">
          <p className="flex justify-between"><span className="text-muted">{t.cart.subtotal}</span>{formatSAR(Number(order.subtotal_sar), locale)}</p>
          <p className="flex justify-between"><span className="text-muted">{t.cart.shipping}</span>{Number(order.shipping_sar) ? formatSAR(Number(order.shipping_sar), locale) : t.cart.free}</p>
          <p className="flex justify-between text-lg font-bold text-deep"><span>{t.cart.total}</span>{formatSAR(Number(order.total_sar), locale)}</p>
        </div>
        {plantItems.length ? <AddToSpaceButton orderId={order.id} alreadyAdded={(count ?? 0) >= plantUnits} /> : <p className="text-sm text-muted">{t.checkout.noPlants}</p>}
      </div>
    </div>
  );
}
