"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Heart, PawPrint, ShoppingBag } from "lucide-react";
import { useCart, useT, useWishlist } from "@/components/layout/Providers";
import type { CardProduct } from "@/lib/catalog/card";
import { PlantImage } from "./PlantImage";
import { Price } from "./Price";

export function ProductCard({ p, priority }: { p: CardProduct; priority?: boolean }) {
  const { t, locale } = useT();
  const cart = useCart();
  const wish = useWishlist();
  const [added, setAdded] = useState(false);
  const [wishMsg, setWishMsg] = useState<string | null>(null);
  const inWish = wish.ids.has(p.id);
  const soldOut = p.stock < 1;

  const addToCart = () => {
    cart.add(p.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };
  const toggleWish = async () => {
    const r = await wish.toggle(p.id);
    if (r === "auth") setWishMsg(t.auth.required);
    else if (r === "error") setWishMsg(t.common.error);
    else setWishMsg(null);
  };

  return (
    <article className="group card relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <Link href={`/products/${p.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-soft">
        <PlantImage src={p.image} alt={p.name} priority={priority} sizes="(min-width:1280px) 22vw, (min-width:768px) 30vw, 50vw" className="transition duration-500 group-hover:scale-[1.04]" />
        <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
          {p.isNew && <span className="chip bg-white/95">{locale === "ar" ? "جديد" : "New"}</span>}
          {p.isBest && <span className="chip bg-white/95">{locale === "ar" ? "الأكثر مبيعًا" : "Best seller"}</span>}
          {p.petSafe && <span className="chip bg-white/95" title={t.shop.petSafe}><PawPrint className="size-3" />{locale === "ar" ? "آمنة" : "Pet-safe"}</span>}
        </div>
      </Link>
      <button onClick={toggleWish} aria-pressed={inWish} aria-label={inWish ? t.product.wishlisted : t.product.wishlist}
        className="absolute end-3 top-3 grid size-9 place-items-center rounded-full bg-white/95 text-saudi shadow-sm transition hover:scale-105">
        <Heart className={`size-4 ${inWish ? "fill-saudi" : ""}`} />
      </button>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <Link href={`/products/${p.slug}`} className="font-semibold text-deep hover:text-saudi">{p.name}</Link>
        <p className="text-xs italic text-muted" dir="ltr">{p.subtitle}</p>
        {p.variant && <p className="text-xs text-muted">{p.variant}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <Price amount={p.price} compareAt={p.compareAt} locale={locale} />
          <button onClick={addToCart} disabled={soldOut} className="btn-primary px-3 py-2" aria-label={`${t.product.addToCart}: ${p.name}`}>
            {added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
            <span className="hidden sm:inline">{soldOut ? t.product.outOfStock : added ? t.product.added : t.product.addToCart}</span>
          </button>
        </div>
        {wishMsg && <p className="text-xs text-warn" role="status"><Link href="/account/login" className="underline">{wishMsg}</Link></p>}
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0, row = false }: { products: CardProduct[]; priorityCount?: number; row?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-5 ${row ? "md:grid-cols-4" : "md:grid-cols-3 xl:grid-cols-4"}`}>
      {products.map((p, i) => <ProductCard key={p.id} p={p} priority={i < priorityCount} />)}
    </div>
  );
}
