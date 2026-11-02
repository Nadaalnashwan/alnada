"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart, useSession, useT } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";
import type { CardProduct } from "@/lib/catalog/card";
import { formatSAR } from "@/lib/i18n/format";

export const shippingFor = (subtotal: number) => (subtotal === 0 || subtotal >= 200 ? 0 : 25); // mirrors place_demo_order()

export function useCartLines(products: CardProduct[]) {
  const cart = useCart();
  const lines = cart.lines.map((l) => ({ ...l, p: products.find((p) => p.id === l.productId) })).filter((l): l is typeof l & { p: CardProduct } => !!l.p);
  const subtotal = lines.reduce((a, l) => a + l.p.price * l.qty, 0);
  return { cart, lines, subtotal, shipping: shippingFor(subtotal), total: subtotal + shippingFor(subtotal) };
}

export function CartView({ products }: { products: CardProduct[] }) {
  const { t, locale } = useT();
  const { user, dbReady } = useSession();
  const { cart, lines, subtotal, shipping, total } = useCartLines(products);

  if (!lines.length) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <ShoppingBag className="mx-auto size-10 text-saudi" />
        <h1 className="mt-4 text-xl font-bold text-deep">{t.cart.empty}</h1>
        <p className="mt-2 text-sm text-muted">{t.cart.emptyBody}</p>
        <div className="mt-6 flex justify-center gap-2"><Link href="/shop" className="btn-primary">{t.hero.ctaShop}</Link><Link href="/nada-ai" className="btn-outline">{t.nav.nada}</Link></div>
      </div>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section>
        <h1 className="mb-6 text-3xl font-bold text-deep">{t.cart.title}</h1>
        <ul className="space-y-3">
          {lines.map(({ p, qty }) => (
            <li key={p.id} className="card flex gap-4 p-3">
              <Link href={`/products/${p.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-soft"><PlantImage src={p.image} alt={p.name} sizes="96px" /></Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/products/${p.slug}`} className="font-semibold text-deep hover:text-saudi">{p.name}</Link>
                <p className="text-xs text-muted">{p.variant}</p>
                {qty > p.stock && <p className="text-xs text-danger">{locale === "ar" ? `المتوفر ${p.stock} فقط` : `Only ${p.stock} in stock`}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center rounded-full border border-line">
                    <button className="grid size-8 place-items-center" onClick={() => cart.setQty(p.id, qty - 1)} disabled={qty <= 1} aria-label="−"><Minus className="size-3.5" /></button>
                    <span className="w-7 text-center text-sm font-semibold">{qty}</span>
                    <button className="grid size-8 place-items-center" onClick={() => cart.setQty(p.id, qty + 1)} disabled={qty >= Math.min(20, p.stock)} aria-label="+"><Plus className="size-3.5" /></button>
                  </div>
                  <span className="font-bold text-deep">{formatSAR(p.price * qty, locale)}</span>
                  <button onClick={() => cart.remove(p.id)} className="p-2 text-muted hover:text-danger" aria-label={t.cart.remove}><Trash2 className="size-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">{user && dbReady ? t.cart.saved : t.cart.local}</p>
      </section>
      <aside className="card h-fit space-y-3 p-6 lg:sticky lg:top-24">
        <div className="flex justify-between text-sm"><span className="text-muted">{t.cart.subtotal}</span><span>{formatSAR(subtotal, locale)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted">{t.cart.shipping}</span><span>{shipping ? formatSAR(shipping, locale) : t.cart.free}</span></div>
        <div className="flex justify-between border-t border-line pt-3 text-lg font-bold text-deep"><span>{t.cart.total}</span><span>{formatSAR(total, locale)}</span></div>
        <p className="text-xs text-muted">{t.cart.freeOver}</p>
        <Link href="/checkout" className="btn-primary w-full py-3">{t.cart.checkout}</Link>
        <Link href="/shop" className="btn-ghost w-full">{t.cart.continue}</Link>
        <p className="demo-badge">{t.common.demo}</p>
      </aside>
    </div>
  );
}
