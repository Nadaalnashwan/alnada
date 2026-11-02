"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, Check, Heart, ShoppingBag, Sparkles, Sprout, Trash2 } from "lucide-react";
import { useCart, useT, useWishlist } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";
import { formatDate, formatSAR } from "@/lib/i18n/format";

export interface ExploredCard { id: string; speciesSlug: string; name: string; scientific: string; image: string | null; reason: string | null; at: string; productId: string | null; productSlug: string | null }
export interface WishCard { id: string; slug: string; name: string; scientific: string; image: string | null; price: number; stock: number }

export function ExploredPlantCard({ p }: { p: ExploredCard }) {
  const { t, locale } = useT();
  const wish = useWishlist();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const remove = async () => {
    await fetch("/api/explored", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
    router.refresh();
  };
  return (
    <article className="group flex flex-col rounded-[1.75rem] bg-white p-2 shadow-[var(--shadow-card)] transition duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[4/5] overflow-hidden arch bg-gradient-to-b from-mist to-soft">
        <PlantImage src={p.image} alt={p.name} sizes="(min-width:1024px) 22vw, 50vw" className="transition duration-700 group-hover:scale-105" />
        <span className="absolute start-3 top-3 chip bg-white/95 text-[10px]"><Bookmark className="size-3 text-saudi" />{t.space.explored}</span>
        <button onClick={remove} className="absolute end-3 top-3 grid size-8 place-items-center rounded-full bg-white/90 text-muted shadow-sm transition hover:text-danger" aria-label={t.space.removeExplored}><Trash2 className="size-3.5" /></button>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-2 pt-3">
        <h3 className="font-bold text-forest">{p.name}</h3>
        <p className="text-xs italic text-muted" dir="ltr">{p.scientific}</p>
        {p.reason && <p className="mt-1 text-xs text-deep">{p.reason}</p>}
        <p className="text-[11px] text-muted">{t.space.lastExplored}: {formatDate(p.at, locale, { day: "numeric", month: "long" })}</p>
        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-3">
          <Link href={`/nada-ai?plant=${p.speciesSlug}`} className="btn bg-soft px-2 py-2 text-[11px] text-saudi hover:bg-dew"><Sparkles className="size-3.5" />{t.product.askNada}</Link>
          <Link href={`/my-green-space/add?species=${p.speciesSlug}`} className="btn-primary px-2 py-2 text-[11px]"><Sprout className="size-3.5" />{t.space.markOwned}</Link>
          {p.productId && (
            <button onClick={async () => { const r = await wish.toggle(p.productId!); setMsg(r === "added" ? t.product.wishlisted : r === "removed" ? null : t.common.error); }} className="btn-outline px-2 py-2 text-[11px]">
              <Heart className={`size-3.5 ${wish.ids.has(p.productId) ? "fill-saudi" : ""}`} />{t.product.wishlist}
            </button>
          )}
          {p.productSlug && <Link href={`/products/${p.productSlug}`} className="btn-ghost px-2 py-2 text-[11px]">{t.space.details}</Link>}
        </div>
        {msg && <p className="text-xs text-saudi" role="status">{msg}</p>}
      </div>
    </article>
  );
}

export function WishlistCard({ p }: { p: WishCard }) {
  const { t, locale } = useT();
  const wish = useWishlist();
  const cart = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  return (
    <article className="group flex flex-col rounded-[1.75rem] bg-white p-2 shadow-[var(--shadow-card)] transition duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <Link href={`/products/${p.slug}`} className="relative block aspect-[4/5] overflow-hidden arch bg-gradient-to-b from-mist to-soft">
        <PlantImage src={p.image} alt={p.name} sizes="(min-width:1024px) 22vw, 50vw" className="transition duration-700 group-hover:scale-105" />
        <span className="absolute start-3 top-3 grid size-8 place-items-center rounded-full bg-white/95 text-saudi shadow-sm"><Heart className="size-4 fill-saudi" /></span>
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-2 pt-3">
        <Link href={`/products/${p.slug}`} className="font-bold text-forest hover:text-saudi">{p.name}</Link>
        <p className="text-xs italic text-muted" dir="ltr">{p.scientific}</p>
        <p className="mt-1 flex items-center gap-2"><span className="text-lg font-bold text-forest">{formatSAR(p.price, locale)}</span><span className="demo-badge">{t.common.demo}</span></p>
        <p className={`text-xs ${p.stock > 0 ? "text-saudi" : "text-danger"}`}>{p.stock > 0 ? t.product.inStock : t.product.outOfStock}</p>
        <div className="mt-auto flex gap-2 pt-3">
          <button disabled={p.stock < 1} onClick={() => { cart.add(p.id); setAdded(true); }} className={`btn flex-1 px-3 py-2 text-xs text-white ${added ? "bg-leaf" : "bg-saudi hover:bg-deep"}`}>
            {added ? <Check className="size-3.5 animate-pop" /> : <ShoppingBag className="size-3.5" />}{added ? t.product.added : t.product.addToCart}
          </button>
          <button onClick={async () => { await wish.toggle(p.id); router.refresh(); }} className="btn-outline px-3 py-2" aria-label={t.cart.remove}><Trash2 className="size-3.5" /></button>
        </div>
      </div>
    </article>
  );
}

export function ClearExploredButton() {
  const { t } = useT();
  const router = useRouter();
  return (
    <button className="btn-ghost text-xs text-muted" onClick={async () => {
      if (!confirm(t.space.clearHistory + "?")) return;
      await fetch("/api/explored", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      router.refresh();
    }}><Trash2 className="size-3.5" />{t.space.clearHistory}</button>
  );
}
