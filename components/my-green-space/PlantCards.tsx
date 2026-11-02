"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Bookmark, Check, CircleHelp, Droplets, Heart, Info, MapPin, ShoppingBag, Sparkles, Sprout, Store, Sun, Trash2 } from "lucide-react";
import { useCart, useT, useWishlist } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";
import { formatDate, formatSAR } from "@/lib/i18n/format";
import { PlantBox } from "./PlantBox";

export type PlantStatus = "on_track" | "soil_check_due" | "light_mismatch" | "no_watering_recorded" | "unconfirmed";

export interface OwnedCard {
  id: string; title: string; nickname: string | null; speciesName: string; scientific: string | null; image: string | null; ownPhoto: boolean;
  location: string | null; light: string | null; lastWatered: string | null; lastActivity: string | null; addedAt: string; source: "store_purchase" | "manual"; unconfirmed: boolean;
  status: PlantStatus; daysSinceWatering: number | null; checkInterval: number | null; tip: string | null;
}
export interface ExploredCard { id: string; speciesSlug: string; name: string; scientific: string; image: string | null; reason: string | null; at: string; productId: string | null; productSlug: string | null }
export interface WishCard { id: string; slug: string; name: string; scientific: string; image: string | null; price: number; stock: number }

const STATUS_STYLE: Record<PlantStatus, { cls: string; icon: typeof Check }> = {
  on_track: { cls: "bg-white/95 text-saudi", icon: Check },
  soil_check_due: { cls: "bg-warn-bg text-warn", icon: Droplets },
  light_mismatch: { cls: "bg-warn-bg text-warn", icon: AlertTriangle },
  no_watering_recorded: { cls: "bg-white/95 text-muted", icon: Info },
  unconfirmed: { cls: "bg-white/95 text-muted", icon: CircleHelp },
};

export function statusLabel(s: PlantStatus, ar: boolean) {
  return {
    on_track: ar ? "على المسار حسب سجلاتك" : "On track (your records)",
    soil_check_due: ar ? "حان فحص التربة" : "Time to check soil",
    light_mismatch: ar ? "الإضاءة غير مناسبة" : "Light mismatch",
    no_watering_recorded: ar ? "ما فيه ري مسجل" : "No watering logged",
    unconfirmed: ar ? "تعريف غير مؤكد" : "Unconfirmed ID",
  }[s];
}

/** Days since last recorded watering relative to the species' usual check interval. */
function WaterMeter({ days, interval, ar }: { days: number | null; interval: number | null; ar: boolean }) {
  if (days === null || !interval) return null;
  const pct = Math.min(100, Math.round((days / interval) * 100));
  const tone = pct >= 100 ? "bg-warn" : pct >= 70 ? "bg-sun" : "bg-leaf";
  return (
    <div className="mt-2" aria-label={ar ? `مضى ${days} من ${interval} يوم` : `${days} of ${interval} days`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-mist"><div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${Math.max(6, pct)}%` }} /></div>
    </div>
  );
}

export function OwnedPlantCard({ p, index = 0 }: { p: OwnedCard; index?: number }) {
  const { locale } = useT();
  const ar = locale === "ar";
  const router = useRouter();
  const [watering, setWatering] = useState<"idle" | "busy" | "done" | "err">("idle");
  const st = STATUS_STYLE[p.status];
  const StatusI = st.icon;

  const logWatering = async () => {
    setWatering("busy");
    const res = await fetch("/api/care-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantId: p.id, activity: "watering" }) });
    setWatering(res.ok ? "done" : "err");
    if (res.ok) setTimeout(() => router.refresh(), 700);
  };

  const wateredText = p.lastWatered
    ? p.daysSinceWatering === 0 ? (ar ? "سُقيت اليوم" : "Watered today") : ar ? `آخر ري قبل ${p.daysSinceWatering} يوم` : `Watered ${p.daysSinceWatering} days ago`
    : ar ? "ما فيه ري مسجل" : "No watering logged";

  return (
    <article className="group relative flex flex-col rounded-[2rem] bg-white p-2.5 shadow-[var(--shadow-card)] ring-1 ring-saudi/[0.06] transition duration-500 ease-[var(--ease-organic)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
      style={{ animationDelay: `${index * 70}ms` }}>
      <Link href={`/my-green-space/plants/${p.id}`} className="relative block" aria-label={p.title}>
        <PlantBox id={p.id} image={p.image} alt={p.title} ownPhoto={p.ownPhoto} priority={index < 3} />
        <span className={`absolute start-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${st.cls}`}>
          <StatusI className="size-3.5" />{statusLabel(p.status, ar)}
        </span>
        <span className="absolute end-3 top-3 grid size-8 place-items-center rounded-full bg-white/90 text-saudi shadow-sm" title={p.source === "store_purchase" ? (ar ? "من متجر الندى" : "From AL NADA") : (ar ? "أضفتها بنفسك" : "Added by you")}>
          {p.source === "store_purchase" ? <Store className="size-4" /> : <Sprout className="size-4" />}
        </span>
      </Link>

      <div className="flex flex-1 flex-col px-2.5 pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-bold text-forest">{p.nickname ?? p.speciesName}</h3>
            <p className="truncate text-sm text-muted">
              {p.nickname && p.speciesName}
              {p.nickname && p.scientific && <span className="mx-1.5 text-sage">•</span>}
              {p.scientific && <bdi className="italic">{p.scientific}</bdi>}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.location && <span className="chip bg-mist"><MapPin className="size-3 text-saudi" />{p.location}</span>}
          {p.light && <span className="chip bg-mist"><Sun className="size-3 text-sun" />{p.light}</span>}
        </div>

        <div className="mt-4 rounded-2xl bg-mist/80 p-3">
          <p className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-deep"><Droplets className="size-4 text-saudi" />{wateredText}</span>
            {p.checkInterval && <span className="text-muted">{ar ? `فحص كل ~${p.checkInterval} أيام` : `check ~every ${p.checkInterval}d`}</span>}
          </p>
          <WaterMeter days={p.daysSinceWatering} interval={p.checkInterval} ar={ar} />
          {p.tip && <p className="mt-2.5 text-xs leading-5 text-muted">{p.tip}</p>}
        </div>

        <div className="mt-auto grid grid-cols-[1fr_1fr_auto] gap-2 pt-4">
          <button onClick={logWatering} disabled={watering === "busy" || watering === "done"}
            className={`btn px-3 py-2 text-xs ${watering === "done" ? "bg-leaf text-white" : "bg-soft text-saudi hover:bg-dew"}`}>
            {watering === "done" ? <Check className="size-4 animate-pop" /> : <Droplets className="size-4" />}
            {watering === "done" ? (ar ? "سجلناها" : "Logged") : watering === "err" ? (ar ? "حاول مجددًا" : "Retry") : ar ? "سقيتها اليوم" : "Watered today"}
          </button>
          <Link href={`/nada-ai?userPlant=${p.id}`} className="btn-primary px-3 py-2 text-xs"><Sparkles className="size-4" />{ar ? "اسأل ندى" : "Ask Nada"}</Link>
          <Link href={`/my-green-space/plants/${p.id}`} className="btn-outline px-3 py-2 text-xs" aria-label={ar ? "التفاصيل" : "Details"}><Info className="size-4" /></Link>
        </div>
        <p className="mt-2.5 text-center text-[10px] text-muted">{ar ? "أضيفت في" : "Added"} {formatDate(p.addedAt, locale, { day: "numeric", month: "long", year: "numeric" })}</p>
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
