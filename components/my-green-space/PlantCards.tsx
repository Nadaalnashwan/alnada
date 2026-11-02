"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, CalendarDays, Droplets, Heart, MapPin, ShoppingBag, Sparkles, Sprout, Store, Sun, Trash2 } from "lucide-react";
import { useCart, useT, useWishlist } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";
import { formatDate, formatSAR } from "@/lib/i18n/format";

export interface OwnedCard {
  id: string; title: string; nickname: string | null; speciesName: string; scientific: string | null; image: string | null; ownPhoto: boolean;
  location: string | null; light: string | null; lastWatered: string | null; lastActivity: string | null; addedAt: string; source: "store_purchase" | "manual"; unconfirmed: boolean;
}
export interface ExploredCard { id: string; speciesSlug: string; name: string; scientific: string; image: string | null; reason: string | null; at: string; productId: string | null; productSlug: string | null }
export interface WishCard { id: string; slug: string; name: string; scientific: string; image: string | null; price: number; stock: number }

export function OwnedPlantCard({ p }: { p: OwnedCard }) {
  const { t, locale } = useT();
  return (
    <article className="group card flex flex-col overflow-hidden">
      <Link href={`/my-green-space/plants/${p.id}`} className="relative aspect-[4/3] overflow-hidden bg-soft">
        <PlantImage src={p.image} alt={p.title} sizes="(min-width:1024px) 30vw, 90vw" className="transition duration-500 group-hover:scale-[1.03]" />
        <span className="absolute start-3 top-3 chip bg-white/95">{p.source === "store_purchase" ? <><Store className="size-3" />{t.space.fromStore}</> : <><Sprout className="size-3" />{t.space.manual}</>}</span>
        {p.unconfirmed && <span className="absolute end-3 top-3 chip bg-warn-bg text-warn">{t.space.unconfirmed}</span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg font-bold text-deep">{p.speciesName}{p.nickname && <span className="text-saudi"> — {p.nickname}</span>}</h3>
        {p.scientific && <p className="text-xs italic text-muted" dir="ltr">{p.scientific}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted"><MapPin className="size-3.5 text-saudi" /><span className="truncate">{p.location ?? "—"}</span></div>
          <div className="flex items-center gap-1.5 text-muted"><Sun className="size-3.5 text-saudi" /><span className="truncate">{p.light ?? "—"}</span></div>
          <div className="col-span-2 flex items-center gap-1.5 text-muted"><Droplets className="size-3.5 text-saudi" />{t.space.lastWatered}: <span className="font-medium text-deep">{p.lastWatered ? formatDate(p.lastWatered, locale, { day: "numeric", month: "long" }) : t.space.noWatering}</span></div>
          {p.lastActivity && <div className="col-span-2 flex items-center gap-1.5 text-muted"><CalendarDays className="size-3.5 text-saudi" />{t.space.recent}: <span className="text-deep">{p.lastActivity}</span></div>}
        </dl>
        <div className="mt-auto flex gap-2 pt-4">
          <Link href={`/my-green-space/plants/${p.id}`} className="btn-outline flex-1 px-3 py-2 text-xs">{t.space.details}</Link>
          <Link href={`/nada-ai?userPlant=${p.id}`} className="btn-primary flex-1 px-3 py-2 text-xs"><Sparkles className="size-3.5" />{t.space.ask} {p.nickname ?? p.speciesName}</Link>
        </div>
      </div>
    </article>
  );
}

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
    <article className="card flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] bg-soft"><PlantImage src={p.image} alt={p.name} sizes="(min-width:1024px) 25vw, 50vw" /></div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-bold text-deep">{p.name}</h3>
        <p className="text-xs italic text-muted" dir="ltr">{p.scientific}</p>
        {p.reason && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Bookmark className="size-3" />{p.reason}</p>}
        <p className="text-xs text-muted">{t.space.lastExplored}: {formatDate(p.at, locale, { day: "numeric", month: "long" })}</p>
        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-3 text-xs">
          {p.productSlug && <Link href={`/products/${p.productSlug}`} className="btn-ghost justify-start rounded-lg bg-soft px-2 py-1.5 text-xs">{t.space.details}</Link>}
          <Link href={`/nada-ai?plant=${p.speciesSlug}`} className="btn-ghost justify-start rounded-lg bg-soft px-2 py-1.5 text-xs"><Sparkles className="size-3" />{t.product.askNada}</Link>
          {p.productId && <button onClick={async () => { const r = await wish.toggle(p.productId!); setMsg(r === "added" ? t.product.wishlisted : r === "removed" ? null : t.common.error); }} className="btn-ghost justify-start rounded-lg bg-soft px-2 py-1.5 text-xs"><Heart className={`size-3 ${wish.ids.has(p.productId) ? "fill-saudi" : ""}`} />{t.product.wishlist}</button>}
          <Link href={`/my-green-space/add?species=${p.speciesSlug}`} className="btn-ghost justify-start rounded-lg bg-soft px-2 py-1.5 text-xs"><Sprout className="size-3" />{t.space.markOwned}</Link>
          <button onClick={remove} className="btn-ghost col-span-2 justify-start rounded-lg px-2 py-1.5 text-xs text-muted"><Trash2 className="size-3" />{t.space.removeExplored}</button>
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
    <article className="card flex flex-col overflow-hidden">
      <Link href={`/products/${p.slug}`} className="relative aspect-[4/3] bg-soft"><PlantImage src={p.image} alt={p.name} sizes="(min-width:1024px) 25vw, 50vw" /></Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <Link href={`/products/${p.slug}`} className="font-bold text-deep hover:text-saudi">{p.name}</Link>
        <p className="text-xs italic text-muted" dir="ltr">{p.scientific}</p>
        <p className="mt-1 text-sm"><span className="font-bold text-deep">{formatSAR(p.price, locale)}</span> <span className="demo-badge">{t.common.demo}</span></p>
        <p className={`text-xs ${p.stock > 0 ? "text-saudi" : "text-danger"}`}>{p.stock > 0 ? t.product.inStock : t.product.outOfStock}</p>
        <div className="mt-auto flex gap-2 pt-3">
          <button disabled={p.stock < 1} onClick={() => { cart.add(p.id); setAdded(true); }} className="btn-primary flex-1 px-3 py-2 text-xs"><ShoppingBag className="size-3.5" />{added ? t.product.added : t.product.addToCart}</button>
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
