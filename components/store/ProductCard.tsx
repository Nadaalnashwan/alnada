"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, CloudSun, Droplet, Flame, Heart, Moon, PawPrint, Plus, Sparkles, Sun } from "lucide-react";
import { useCart, useT, useWishlist } from "@/components/layout/Providers";
import type { CardProduct } from "@/lib/catalog/card";
import { formatSAR } from "@/lib/i18n/format";
import { PlantImage } from "./PlantImage";

const LIGHT_ICON = { low: Moon, medium: CloudSun, bright_indirect: CloudSun, full_sun: Sun } as const;
const WATER_DROPS = { low: 1, moderate: 2, high: 3 } as const;
const LEVEL = { easy: 1, moderate: 2, hard: 3 } as const;

/** Light · water · care level, shown as quiet icons so a plant can be judged at a glance. */
export function CareGlance({ care, compact = false }: { care: NonNullable<CardProduct["care"]>; compact?: boolean }) {
  const { t } = useT();
  const LightI = LIGHT_ICON[care.light as keyof typeof LIGHT_ICON] ?? CloudSun;
  return (
    <ul className={`flex items-center gap-2.5 text-muted ${compact ? "text-[10px]" : "text-[11px]"}`}>
      <li className="flex items-center gap-1" title={`${t.product.light}: ${t.attr.light[care.light as keyof typeof t.attr.light]}`}><LightI className="size-3.5 text-sun" /><span className="sr-only">{t.attr.light[care.light as keyof typeof t.attr.light]}</span></li>
      <li className="flex items-center gap-0.5" title={`${t.product.water}: ${t.attr.water[care.water]}`}>
        {[1, 2, 3].map((i) => <Droplet key={i} className={`size-3 ${i <= WATER_DROPS[care.water] ? "fill-saudi/70 text-saudi" : "text-sage"}`} />)}
        <span className="sr-only">{t.attr.water[care.water]}</span>
      </li>
      <li className="flex items-center gap-1" title={`${t.product.difficulty}: ${t.attr.difficulty[care.difficulty]}`}>
        <span className="flex gap-0.5">{[1, 2, 3].map((i) => <span key={i} className={`h-2.5 w-1 rounded-full ${i <= LEVEL[care.difficulty] ? "bg-leaf" : "bg-sage/60"}`} />)}</span>
        <span>{t.attr.difficulty[care.difficulty]}</span>
      </li>
    </ul>
  );
}

export function ProductCard({ p, priority }: { p: CardProduct; priority?: boolean }) {
  const { t, locale } = useT();
  const cart = useCart();
  const wish = useWishlist();
  const [added, setAdded] = useState(false);
  const [wishMsg, setWishMsg] = useState<string | null>(null);
  const inWish = wish.ids.has(p.id);
  const soldOut = p.stock < 1;
  const isPlant = p.kind === "plant" || p.kind === "gift";
  const low = p.stock > 0 && p.stock < 8;

  const addToCart = () => {
    cart.add(p.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };
  const toggleWish = async () => {
    const r = await wish.toggle(p.id);
    setWishMsg(r === "auth" ? t.auth.required : r === "error" ? t.common.error : null);
  };

  return (
    <article className="group relative flex flex-col rounded-[1.75rem] bg-white p-2 ring-1 ring-saudi/[0.06] transition duration-500 ease-[var(--ease-organic)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] hover:ring-saudi/10">
      {/* stage */}
      <div className="relative">
        <Link href={`/products/${p.slug}`} className={`relative block aspect-[4/5] overflow-hidden bg-gradient-to-b from-mist to-soft ${isPlant ? "arch" : "rounded-[1.4rem]"}`}>
          <PlantImage src={p.image} alt={p.name} priority={priority} sizes="(min-width:1280px) 22vw, (min-width:768px) 30vw, 50vw" className="transition duration-700 ease-[var(--ease-organic)] group-hover:scale-[1.06]" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forest/25 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
        </Link>

        <div className="pointer-events-none absolute start-2.5 top-3 flex flex-col items-start gap-1.5 sm:start-3">
          {p.isNew && <span className="chip bg-white/95 text-[10px] shadow-sm"><Sparkles className="size-3 text-sun" />{locale === "ar" ? "جديد" : "New"}</span>}
          {p.isBest && <span className="chip bg-white/95 text-[10px] shadow-sm"><Flame className="size-3 text-leaf" />{locale === "ar" ? "الأكثر طلبًا" : "Loved"}</span>}
          {p.petSafe && <span className="chip bg-white/95 text-[10px] shadow-sm" title={t.shop.petSafe}><PawPrint className="size-3 text-saudi" />{locale === "ar" ? "آمنة للحيوانات" : "Pet-safe"}</span>}
        </div>

        <button onClick={toggleWish} aria-pressed={inWish} aria-label={inWish ? t.product.wishlisted : t.product.wishlist}
          className="absolute end-2.5 top-3 grid size-9 place-items-center rounded-full bg-white/90 text-saudi shadow-sm backdrop-blur transition duration-300 hover:scale-110 sm:end-3">
          <Heart className={`size-4 transition ${inWish ? "scale-110 fill-saudi" : ""}`} />
        </button>

        {/* quick add: icon on touch, expands on hover */}
        <button onClick={addToCart} disabled={soldOut} aria-label={`${t.product.addToCart}: ${p.name}`}
          className={`absolute bottom-3 end-3 flex h-11 items-center gap-2 overflow-hidden rounded-full px-3.5 text-sm font-semibold text-white shadow-[var(--shadow-glow)] transition-all duration-500 ease-[var(--ease-organic)] disabled:bg-muted ${added ? "bg-leaf" : "bg-saudi hover:bg-deep"} sm:w-11 sm:justify-center sm:px-0 sm:group-hover:w-auto sm:group-hover:px-4`}>
          {added ? <Check className="size-[1.1rem] shrink-0 animate-pop" /> : <Plus className="size-[1.1rem] shrink-0" />}
          <span className="hidden whitespace-nowrap sm:group-hover:inline">{soldOut ? t.product.outOfStock : added ? t.product.added : t.product.addToCart}</span>
        </button>
      </div>

      {/* details */}
      <div className="flex flex-1 flex-col gap-1.5 px-2.5 pb-2.5 pt-3.5 sm:px-3">
        <Link href={`/products/${p.slug}`} className="line-clamp-1 text-[0.95rem] font-bold text-forest transition group-hover:text-saudi sm:text-base">{p.name}</Link>
        <p className="line-clamp-1 text-xs italic text-muted" dir="ltr">{p.subtitle}</p>
        {p.care && <div className="pt-0.5"><CareGlance care={p.care} /></div>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <div className="leading-tight">
            <p className="text-lg font-bold text-forest">{formatSAR(p.price, locale)}</p>
            {p.compareAt && p.compareAt > p.price && <s className="text-xs text-muted">{formatSAR(p.compareAt, locale)}</s>}
          </div>
          <p className={`max-w-[50%] truncate text-end text-[11px] ${soldOut ? "font-semibold text-danger" : low ? "font-semibold text-warn" : "text-muted"}`}>
            {soldOut ? t.product.outOfStock : low ? `${t.product.lowStock} · ${p.stock}` : p.variant}
          </p>
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
