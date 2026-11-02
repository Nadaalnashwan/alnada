"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Check, CheckCircle2, ClipboardList, Droplets, Heart, LogIn, MapPin, ShoppingBag, Sprout } from "lucide-react";
import { useCart, useT, useWishlist } from "@/components/layout/Providers";
import { PlantBox } from "@/components/my-green-space/PlantBox";
import { PlantImage } from "@/components/store/PlantImage";
import { formatDate, formatSAR } from "@/lib/i18n/format";
import type { ChatBlock, ProductCardData } from "@/lib/ai/schemas";

const FLAG_LABEL = {
  ar: { soil_check_due: "افحص التربة", light_mismatch: "الإضاءة غير مناسبة", no_watering_recorded: "ما فيه ري مسجل", recent_observation: "ملاحظة صحية" },
  en: { soil_check_due: "Check soil", light_mismatch: "Light mismatch", no_watering_recorded: "No watering logged", recent_observation: "Health note" },
} as const;

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
    <div className="group flex flex-col rounded-[1.5rem] bg-white p-1.5 shadow-[var(--shadow-card)] ring-1 ring-saudi/[0.06] transition duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <Link href={`/products/${p.slug}`} className="relative aspect-[5/4] overflow-hidden rounded-[1.2rem] bg-gradient-to-b from-mist to-soft">
        <PlantImage src={p.image} alt={p.name} sizes="260px" className="transition duration-700 group-hover:scale-105" />
        {p.rank && <span className="absolute start-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white text-sm font-bold text-saudi shadow-[var(--shadow-inner-dew)] ring-1 ring-saudi/10">{p.rank}</span>}
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
          <button className="btn-primary flex-1 whitespace-nowrap px-2 py-1.5 text-xs" disabled={p.stock < 1} aria-label={`${t.product.addToCart}: ${p.name}`} onClick={() => { cart.add(p.id); setState(t.product.added); }}>
            <ShoppingBag className="size-3.5 shrink-0" /><span className="hidden min-[420px]:inline">{p.stock < 1 ? t.product.outOfStock : t.product.addToCart}</span>
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

function Checklist({ title, items, tone }: { title: string; items: string[]; tone: "care" | "rescue" }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setDone((d) => { const n = new Set(d); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <section className={`rounded-[1.5rem] p-4 ring-1 ${tone === "rescue" ? "bg-warn-bg/60 ring-warn/15" : "bg-white ring-saudi/10"}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold text-forest"><ClipboardList className={`size-4 ${tone === "rescue" ? "text-warn" : "text-saudi"}`} />{title}</h4>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-line">{done.size}/{items.length}</span>
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i}>
            <button type="button" onClick={() => toggle(i)} aria-pressed={done.has(i)} className="flex w-full items-start gap-2.5 rounded-xl p-1.5 text-start transition hover:bg-mist">
              <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 transition ${done.has(i) ? "bg-saudi text-white ring-saudi" : "bg-white ring-sage"}`}>{done.has(i) && <Check className="size-3 animate-pop" />}</span>
              <span className={`leading-6 transition ${done.has(i) ? "text-muted line-through" : "text-ink"}`}>{it}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
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
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">{block.items.map((p) => <ProductMini key={p.id} p={p} />)}</div>
        </section>
      );
    case "user_plants":
      return (
        <section>
          <h4 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-forest"><Sprout className="size-4 text-saudi" />{block.title}</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {block.items.map((p) => (
              <Link key={p.id} href={`/my-green-space/plants/${p.id}`} className="group rounded-[1.5rem] bg-white p-1.5 shadow-[var(--shadow-card)] ring-1 ring-saudi/[0.06] transition duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <PlantBox id={p.id} image={p.image} alt={p.title} size="sm" />
                <div className="px-1.5 pb-1.5 pt-2.5 text-[11px] text-muted">
                  <p className="truncate text-sm font-bold text-forest">{p.title}</p>
                  <p className="truncate italic" dir="ltr">{p.species}</p>
                  <p className="mt-1.5 flex items-center gap-1"><Droplets className="size-3 text-saudi" />{p.lastWatered ? formatDate(p.lastWatered, locale, { day: "numeric", month: "long" }) : t.space.noWatering}</p>
                  {p.location && <p className="flex items-center gap-1"><MapPin className="size-3 text-saudi" />{p.location}</p>}
                  {!!p.flags?.length && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.flags.map((f) => <span key={f} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${f === "light_mismatch" || f === "soil_check_due" ? "bg-warn-bg text-warn" : "bg-soft text-saudi"}`}>{FLAG_LABEL[locale][f]}</span>)}
                    </div>
                  )}
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
      return <Checklist title={block.title} items={block.items} tone={block.tone} />;
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
