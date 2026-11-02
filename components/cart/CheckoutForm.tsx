"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useSession, useT } from "@/components/layout/Providers";
import type { CardProduct } from "@/lib/catalog/card";
import { formatSAR } from "@/lib/i18n/format";
import { useCartLines } from "./CartView";

export function CheckoutForm({ products, defaults }: { products: CardProduct[]; defaults: { name: string; city: string } }) {
  const { t, locale } = useT();
  const { user, dbReady } = useSession();
  const router = useRouter();
  const { cart, lines, subtotal, shipping, total } = useCartLines(products);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!dbReady) return <p className="card mx-auto max-w-lg p-6 text-sm leading-7 text-warn">{t.auth.notConfigured}</p>;
  if (!user) return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="text-deep">{t.checkout.signIn}</p>
      <Link href="/account/login?next=/checkout" className="btn-primary mt-4">{t.auth.signIn}</Link>
    </div>
  );
  if (!lines.length) return <div className="card mx-auto max-w-lg p-8 text-center"><p>{t.cart.empty}</p><Link href="/shop" className="btn-primary mt-4">{t.hero.ctaShop}</Link></div>;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: lines.map((l) => ({ product_id: l.productId, quantity: l.qty })), contact: { name: fd.get("name"), city: fd.get("city") } }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const code = String(data.error ?? "");
      setError(code.startsWith("INSUFFICIENT_STOCK") ? (locale === "ar" ? "بعض المنتجات ما فيها كمية كافية. عدّل الكميات وحاول مرة ثانية." : "Some items don't have enough stock. Adjust quantities and retry.")
        : code.startsWith("PRODUCT_UNAVAILABLE") ? (locale === "ar" ? "أحد المنتجات لم يعد متوفرًا." : "A product is no longer available.") : t.common.error);
      return;
    }
    cart.clear();
    router.push(`/orders/${data.order.id}?new=1`);
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section className="card space-y-5 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-deep">{t.checkout.title}</h1>
        <p className="flex gap-2 rounded-2xl bg-warn-bg p-4 text-sm leading-7 text-warn"><ShieldCheck className="mt-1 size-5 shrink-0" />{t.checkout.demoNotice}</p>
        <label className="block"><span className="label">{t.checkout.name}</span><input name="name" required maxLength={120} defaultValue={defaults.name} className="input" autoComplete="name" /></label>
        <label className="block"><span className="label">{t.checkout.city}</span><input name="city" required maxLength={80} defaultValue={defaults.city} className="input" autoComplete="address-level2" /></label>
        {error && <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      </section>
      <aside className="card h-fit space-y-3 p-6">
        <ul className="space-y-2 text-sm">{lines.map((l) => <li key={l.productId} className="flex justify-between gap-2"><span className="truncate">{l.p.name} × {l.qty}</span><span>{formatSAR(l.p.price * l.qty, locale)}</span></li>)}</ul>
        <div className="flex justify-between border-t border-line pt-3 text-sm"><span className="text-muted">{t.cart.shipping}</span><span>{shipping ? formatSAR(shipping, locale) : t.cart.free}</span></div>
        <div className="flex justify-between text-lg font-bold text-deep"><span>{t.cart.total}</span><span>{formatSAR(total, locale)}</span></div>
        <p className="text-[11px] text-muted">{locale === "ar" ? `المجموع النهائي يُحسب في الخادم من أسعار قاعدة البيانات (${formatSAR(subtotal, locale)} قبل الشحن).` : `Final total is computed server-side from database prices (${formatSAR(subtotal, locale)} before shipping).`}</p>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? t.checkout.placing : t.checkout.place}</button>
      </aside>
    </form>
  );
}
