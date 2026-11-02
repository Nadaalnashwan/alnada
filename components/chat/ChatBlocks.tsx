"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Droplets, Heart, LogIn, MapPin, ShoppingBag, Sun } from "lucide-react";
import { useCart, useT, useWishlist } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";
import { formatDate, formatSAR } from "@/lib/i18n/format";
import type { ChatBlock, ProductCardData } from "@/lib/ai/schemas";

/** Tiny safe formatter for model text: paragraphs, bullet lists and **bold** (no HTML injection). */
export function RichText({ text }: { text: string }) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`u${out.length}`} className="my-1 space-y-1">{list.map((l, i) => <li key={i} className="flex gap-2"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-saudi" /><span>{bold(l)}</span></li>)}</ul>);
    list = [];
  };
  for (const l of lines) {
    const m = l.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (m) list.push(m[1]);
    else { flush(); out.push(<p key={`p${out.length}`}>{bold(l.replace(/^#+\s*/, ""))}</p>); }
  }
  flush();
  return <div className="space-y-2 leading-7">{out}</div>;
}

function ProductMini({ p }: { p: ProductCardData }) {
  const { t, locale } = useT();
  const cart = useCart();
  const wish = useWishlist();
  const [state, setState] = useState<string | null>(null);
  return (
    <div className="card flex flex-col overflow-hidden">
      <Link href={`/products/${p.slug}`} className="relative aspect-[4/3] bg-soft">
        <PlantImage src={p.image} alt={p.name} sizes="240px" />
        {p.rank && <span className="absolute start-2 top-2 grid size-7 place-items-center rounded-full bg-saudi text-xs font-bold text-white">{p.rank}</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Link href={`/products/${p.slug}`} className="font-semibold text-deep hover:text-saudi">{p.name}</Link>
        {p.scientific && <p className="text-xs italic text-muted" dir="ltr">{p.scientific}</p>}
        {p.reasons.length > 0 && <ul className="space-y-0.5 text-xs text-ink/80">{p.reasons.slice(0, 4).map((r) => <li key={r} className="flex gap-1.5"><CheckCircle2 className="mt-0.5 size-3 shrink-0 text-saudi" />{r}</li>)}</ul>}
        {p.cautions.length > 0 && <ul className="space-y-0.5 text-xs text-warn">{p.cautions.map((r) => <li key={r} className="flex gap-1.5"><AlertCircle className="mt-0.5 size-3 shrink-0" />{r}</li>)}</ul>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-sm font-bold text-deep">{formatSAR(p.price, locale)} <span className="demo-badge ms-1 align-middle">{t.common.demo}</span></span>
        </div>
        <div className="flex gap-1.5">
          <button className="btn-primary flex-1 px-2 py-1.5 text-xs" disabled={p.stock < 1} onClick={() => { cart.add(p.id); setState(t.product.added); }}>
            <ShoppingBag className="size-3.5" />{p.stock < 1 ? t.product.outOfStock : t.product.addToCart}
          </button>
          <button className="btn-outline px-2.5 py-1.5" aria-label={t.product.wishlist} onClick={async () => {
            const r = await wish.toggle(p.id);
            setState(r === "auth" ? t.auth.required : r === "error" ? t.common.error : r === "added" ? t.product.wishlisted : null);
          }}>
            <Heart className={`size-3.5 ${wish.ids.has(p.id) ? "fill-saudi" : ""}`} />
          </button>
        </div>
        {state && <p className="text-xs text-saudi" role="status">{state}</p>}
      </div>
    </div>
  );
}

export function ChatBlockView({ block, onChoose }: { block: ChatBlock; onChoose: (plantId: string, label: string) => void }) {
  const { t, locale } = useT();
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "err">("idle");

  switch (block.type) {
    case "products":
      return (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-deep">{block.title}</h4>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{block.items.map((p) => <ProductMini key={p.id} p={p} />)}</div>
        </section>
      );
    case "user_plants":
      return (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-deep">{block.title}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {block.items.map((p) => (
              <Link key={p.id} href={`/my-green-space/plants/${p.id}`} className="card flex gap-3 overflow-hidden p-2 transition hover:shadow-[var(--shadow-lift)]">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-soft"><PlantImage src={p.image} alt={p.title} sizes="80px" /></div>
                <div className="min-w-0 py-1 text-xs text-muted">
                  <p className="truncate text-sm font-semibold text-deep">{p.title}</p>
                  <p className="italic" dir="ltr">{p.species}</p>
                  {p.location && <p className="mt-1 flex items-center gap-1"><MapPin className="size-3" />{p.location}</p>}
                  {p.light && <p className="flex items-center gap-1"><Sun className="size-3" />{p.light}</p>}
                  <p className="flex items-center gap-1"><Droplets className="size-3" />{p.lastWatered ? formatDate(p.lastWatered, locale, { day: "numeric", month: "long" }) : t.space.noWatering}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      );
    case "species":
      return (
        <section className="card flex flex-col gap-3 overflow-hidden p-3 sm:flex-row">
          <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-soft sm:size-36 sm:aspect-auto"><PlantImage src={block.item.image} alt={block.item.name} sizes="160px" /></div>
          <div className="min-w-0">
            <p className="font-semibold text-deep">{block.item.name}</p>
            <p className="text-xs italic text-muted" dir="ltr">{block.item.scientific}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {block.item.facts.map((f) => <div key={f.label}><dt className="text-muted">{f.label}</dt><dd className="font-medium text-deep">{f.value}</dd></div>)}
            </dl>
            {block.item.productSlug && <Link href={`/products/${block.item.productSlug}`} className="mt-2 inline-block text-xs font-semibold text-saudi hover:underline">{locale === "ar" ? "عرضها في المتجر" : "View in store"}</Link>}
          </div>
        </section>
      );
    case "checklist":
      return (
        <section className={`rounded-2xl p-4 ${block.tone === "rescue" ? "bg-warn-bg/70" : "bg-soft"}`}>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-deep"><ClipboardList className="size-4" />{block.title}</h4>
          <ul className="space-y-1.5 text-sm">
            {block.items.map((i, n) => (
              <li key={n}><label className="flex cursor-pointer items-start gap-2"><input type="checkbox" className="mt-1 size-4 accent-saudi" /><span>{i}</span></label></li>
            ))}
          </ul>
        </section>
      );
    case "care_logs":
      return (
        <section className="rounded-2xl border border-line p-4">
          <h4 className="mb-2 text-sm font-semibold text-deep">{block.title}</h4>
          {block.items.length === 0 ? <p className="text-sm text-muted">{t.plant.noHistory}</p> : (
            <ol className="space-y-2 border-s-2 border-soft ps-4 text-sm">
              {block.items.map((l, i) => (
                <li key={i} className="relative">
                  <span className="absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full bg-saudi" />
                  <span className="font-medium text-deep">{formatDate(l.occurred_at, locale, { day: "numeric", month: "long" })}</span> — {t.plant.activity[l.activity as keyof typeof t.plant.activity] ?? l.activity}
                  {l.notes && <span className="text-muted"> · {l.notes}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      );
    case "action": {
      const tone = block.status === "success" ? "bg-soft text-saudi" : block.status === "failed" ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn";
      return (
        <section className={`rounded-2xl p-3 text-sm ${tone}`} role="status">
          <p className="flex items-start gap-2">{block.status === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}{block.message}</p>
          {block.status === "needs_auth" && <Link href="/account/login?next=/nada-ai" className="btn-primary mt-2 px-3 py-1.5 text-xs"><LogIn className="size-3.5" />{t.auth.signIn}</Link>}
          {block.choices && (
            <div className="mt-2 flex flex-wrap gap-2">
              {block.choices.map((c) => <button key={c.id} onClick={() => onChoose(c.id, c.label)} className="chip bg-white hover:bg-saudi hover:text-white">{c.label}</button>)}
            </div>
          )}
        </section>
      );
    }
    case "save_observation":
      return (
        <button
          disabled={saved === "saving" || saved === "ok"}
          onClick={async () => {
            setSaved("saving");
            const res = await fetch("/api/care-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantId: block.plantId, activity: "observation", notes: block.note }) });
            setSaved(res.ok ? "ok" : "err");
          }}
          className="btn-outline px-3 py-1.5 text-xs"
        >
          <ClipboardList className="size-3.5" />{saved === "ok" ? t.nada.saved : saved === "err" ? t.common.error : t.nada.saveObservation}
          <span className="sr-only">: {block.note}</span>
        </button>
      );
  }
}
