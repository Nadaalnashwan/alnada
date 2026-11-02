"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CalendarClock, Camera, Check, ChevronLeft, ChevronRight, ClipboardList, Droplets, ExternalLink, Gauge, Info, MapPin,
  MessageCircle, NotebookPen, Sparkles, Sprout, Store, Sun, Thermometer, Waves,
} from "lucide-react";
import { Leaf } from "@/components/brand/Decor";
import { useT } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";
import { dayCount, formatDate } from "@/lib/i18n/format";
import { CareLogForm, DeleteLogButton, PlantEditor } from "./PlantManager";
import { AddPlantPot, PottedPlant, type Habit, type Size } from "./PottedPlant";

export type GardenStatus = "on_track" | "soil_check_due" | "light_mismatch" | "no_watering_recorded" | "unconfirmed";

/** Everything the garden needs for one owned plant — all from the user's Supabase records. */
export interface GardenPlant {
  id: string;
  nickname: string | null;
  speciesName: string;
  scientific: string | null;
  speciesSlug: string | null;
  productSlug: string | null;
  image: string | null;
  ownPhoto: boolean;
  speciesImage: string | null;
  habit: Habit;
  size: Size;
  location: string | null;
  lightCondition: string | null;
  lightLabel: string | null;
  needsLight: string[];
  waterNeed: string | null;
  humidity: string | null;
  temp: string | null;
  difficulty: string | null;
  source: "store_purchase" | "manual";
  addedAt: string;
  acquiredAt: string | null;
  wateringPreference: string | null;
  notes: string | null;
  unconfirmed: boolean;
  status: GardenStatus;
  daysSinceWatering: number | null;
  checkInterval: number | null;
  lastWatered: string | null;
  suggestions: string[];
  tips: string[];
  problems: string[];
  observations: { date: string; note: string }[];
  logs: { id: string; activity: string; occurred_at: string; notes: string | null }[];
  consultations: { id: string; title: string | null; updated_at: string }[];
}

export function gardenStatusLabel(s: GardenStatus, ar: boolean) {
  return {
    on_track: ar ? "على المسار حسب سجلاتك" : "On track (your records)",
    soil_check_due: ar ? "حان فحص التربة" : "Time to check the soil",
    light_mismatch: ar ? "الإضاءة غير مناسبة" : "Light mismatch",
    no_watering_recorded: ar ? "ما فيه ري مسجل" : "No watering logged",
    unconfirmed: ar ? "تعريف غير مؤكد" : "Unconfirmed ID",
  }[s];
}

/* ─────────────────────────────── garden ─────────────────────────────── */

export function Garden({ plants, initialId }: { plants: GardenPlant[]; initialId?: string | null }) {
  const { locale } = useT();
  const ar = locale === "ar";
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(() => (initialId && plants.some((p) => p.id === initialId) ? initialId : defaultPick(plants)));
  const [wateringId, setWateringId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const shelfRef = useRef<HTMLUListElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ start: false, end: false });

  // Keep the selection valid when the server data refreshes (e.g. after removing a plant).
  useEffect(() => {
    if (!plants.some((p) => p.id === selectedId)) setSelectedId(defaultPick(plants));
  }, [plants, selectedId]);

  const selected = useMemo(() => plants.find((p) => p.id === selectedId) ?? null, [plants, selectedId]);

  const select = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("plant", id);
    window.history.replaceState(null, "", url);
    // On small screens bring the details into view without hiding the whole garden.
    requestAnimationFrame(() => {
      const el = detailsRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.8) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const updateScroll = useCallback(() => {
    const el = shelfRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft); // RTL scrollLeft is negative in modern browsers
    setCanScroll({ start: pos > 4, end: pos < max - 4 });
  }, []);
  useEffect(() => {
    updateScroll();
    window.addEventListener("resize", updateScroll);
    return () => window.removeEventListener("resize", updateScroll);
  }, [updateScroll, plants.length]);
  const scrollBy = (dir: 1 | -1) => {
    const el = shelfRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.7, behavior: "smooth" });
  };

  const waterNow = async (id: string) => {
    setWateringId(id);
    const res = await fetch("/api/care-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantId: id, activity: "watering" }) });
    if (res.ok) {
      setToast(ar ? "سجلنا الري ✓ نبتتك ممتنة" : "Watering logged ✓");
      router.refresh(); // recompute status, timeline and insights from Supabase
    } else {
      setToast(ar ? "ما قدرنا نسجل الري، حاول مرة ثانية" : "Couldn't log watering, please retry");
    }
    setTimeout(() => setWateringId(null), 1400);
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <div>
      {/* The shared garden wall + shelf */}
      <section aria-label={ar ? "حديقتي" : "My garden"} className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(180deg,#fbf8f1_0%,#f6f3ea_55%,#efe9db_100%)] ring-1 ring-[#ebe2cc]">
        {/* window light & leaf shadows */}
        <span aria-hidden className="pointer-events-none absolute -top-24 start-[8%] h-80 w-[26rem] rotate-[-14deg] rounded-[3rem] bg-gradient-to-b from-white/90 to-transparent blur-2xl" />
        <span aria-hidden className="pointer-events-none absolute -top-10 end-[12%] h-64 w-40 rotate-12 rounded-[2rem] bg-white/50 blur-xl" />
        <Leaf className="pointer-events-none absolute end-[6%] top-4 h-40 w-20 rotate-[24deg] text-saudi/[0.05] blur-[1px]" />
        <Leaf className="pointer-events-none absolute end-[14%] top-14 h-28 w-14 -rotate-[18deg] text-saudi/[0.04] blur-[1px]" />
        <Leaf className="pointer-events-none absolute start-[30%] -top-6 h-32 w-16 rotate-[160deg] text-saudi/[0.04] blur-[1px]" />

        {/* shelf scroll controls (only when the shelf overflows) */}
        {(canScroll.start || canScroll.end) && (
          <div className="absolute end-4 top-4 z-20 hidden gap-1.5 sm:flex">
            <button type="button" onClick={() => scrollBy(-1)} disabled={!canScroll.start} className="grid size-9 place-items-center rounded-full bg-white/90 text-deep shadow-sm transition hover:bg-white disabled:opacity-40" aria-label={ar ? "السابق" : "Previous"}><ChevronRight className="size-4 ltr:rotate-180" /></button>
            <button type="button" onClick={() => scrollBy(1)} disabled={!canScroll.end} className="grid size-9 place-items-center rounded-full bg-white/90 text-deep shadow-sm transition hover:bg-white disabled:opacity-40" aria-label={ar ? "التالي" : "Next"}><ChevronLeft className="size-4 ltr:rotate-180" /></button>
          </div>
        )}

        <div className="relative">
          <ul ref={shelfRef} onScroll={updateScroll}
            className="relative z-10 flex snap-x snap-mandatory items-end gap-1 overflow-x-auto px-4 pb-1 pt-8 [--plant-scale:0.78] sm:[--plant-scale:1] [scrollbar-width:none] sm:gap-5 sm:px-10 sm:pt-12 [&::-webkit-scrollbar]:hidden"
            aria-label={ar ? "نباتاتي" : "My plants"}>
            {plants.map((p, i) => (
              <PottedPlant key={p.id} index={i} id={p.id} image={p.image} label={p.nickname ?? p.speciesName} sublabel={p.nickname ? p.speciesName : (p.location ?? "")}
                habit={p.habit} size={p.size} status={p.status} statusLabel={gardenStatusLabel(p.status, ar)}
                selected={p.id === selectedId} watering={p.id === wateringId} onSelect={() => select(p.id)} />
            ))}
            <AddPlantPot href="/my-green-space/add" label={ar ? "أضف نبتة" : "Add a plant"} hint={ar ? "ازرع نبتة جديدة" : "Plant a new one"} />
            <li aria-hidden className="w-2 shrink-0" />
          </ul>
          {/* soft edge fades hint that the shelf scrolls */}
          {/* fades are opaque at the outer edge: RTL start = right, end = left */}
          {canScroll.start && <span aria-hidden className="pointer-events-none absolute inset-y-0 start-0 z-20 w-10 bg-gradient-to-r from-transparent to-[#f6f2e8]/90 ltr:bg-gradient-to-l" />}
          {canScroll.end && <span aria-hidden className="pointer-events-none absolute inset-y-0 end-0 z-20 w-10 bg-gradient-to-l from-transparent to-[#f6f2e8]/90 ltr:bg-gradient-to-r" />}
          {/* the shelf the pots stand on */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[4.2rem] z-0 h-0">
            <div className="mx-3 h-4 rounded-full bg-gradient-to-b from-[#e8d9b9] to-[#d2bd94] shadow-[0_14px_22px_-10px_rgb(91_70_40/0.45)] sm:mx-6" />
            <div className="mx-6 h-2 rounded-b-full bg-[#c4ad82]/70 sm:mx-9" />
          </div>
        </div>
        <p className="relative z-10 px-6 pb-5 pt-2 text-center text-[11px] text-muted sm:px-10">
          {ar ? "اضغط على أي نبتة لعرض تفاصيلها وسجل عنايتها" : "Tap any plant to see its details and care history"}
        </p>
      </section>

      {/* toast */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && <p className="animate-pop rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-lift)]">{toast}</p>}
      </div>

      {/* Details of the selected plant */}
      <div ref={detailsRef} id="plant-details" className="scroll-mt-28">
        {selected && <PlantDetails key={selected.id} p={selected} onWater={() => waterNow(selected.id)} watering={wateringId === selected.id} />}
      </div>
    </div>
  );
}

/** Pick the plant that needs attention first, otherwise the first one. */
function defaultPick(plants: GardenPlant[]) {
  return (plants.find((p) => p.status === "soil_check_due" || p.status === "light_mismatch") ?? plants[0])?.id ?? null;
}

/* ─────────────────────────────── details ─────────────────────────────── */

function Stat({ icon: I, label, value, tone = "default" }: { icon: typeof Sun; label: string; value: React.ReactNode; tone?: "default" | "warn" }) {
  return (
    <div className={`rounded-2xl p-3.5 ring-1 ${tone === "warn" ? "bg-warn-bg/70 ring-warn/15" : "bg-mist/80 ring-saudi/[0.06]"}`}>
      <p className="flex items-center gap-1.5 text-[11px] text-muted"><I className={`size-3.5 ${tone === "warn" ? "text-warn" : "text-saudi"}`} />{label}</p>
      <div className="mt-1 text-sm font-bold text-forest">{value}</div>
    </div>
  );
}

function PlantDetails({ p, onWater, watering }: { p: GardenPlant; onWater: () => void; watering: boolean }) {
  const { t, locale } = useT();
  const ar = locale === "ar";
  const [logOpen, setLogOpen] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const alert = p.status === "soil_check_due" || p.status === "light_mismatch";
  const nextCheck = p.daysSinceWatering === null || p.checkInterval === null ? null : Math.max(0, p.checkInterval - p.daysSinceWatering);
  const wateredToday = p.daysSinceWatering === 0;
  const checklist = [...p.suggestions, ...p.tips];
  const date = (iso: string, withYear = false) => formatDate(iso, locale, withYear ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long" });

  return (
    <article className="relative mt-6 animate-settle overflow-hidden rounded-[2.5rem] bg-white shadow-[var(--shadow-lift)] ring-1 ring-saudi/[0.08]" aria-label={p.nickname ?? p.speciesName}>
      {/* header */}
      <header className="relative grid gap-6 bg-botanical p-5 sm:grid-cols-[auto_1fr] sm:p-8">
        <Leaf className="pointer-events-none absolute end-6 top-4 h-32 w-16 rotate-12 text-saudi/[0.06]" />
        <div className="relative mx-auto aspect-[4/5] w-40 overflow-hidden arch bg-soft shadow-[var(--shadow-lift)] ring-[5px] ring-white sm:mx-0 sm:w-44">
          <PlantImage src={p.image} alt={p.nickname ?? p.speciesName} sizes="176px" />
          {watering && (
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-6 flex justify-center gap-3">
              {[0, 1, 2, 3].map((d) => <span key={d} className="block h-4 w-3 animate-drip rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-b from-sky-100 to-sky-400 shadow" style={{ animationDelay: `${d * 140}ms` }} />)}
            </span>
          )}
          {p.ownPhoto && <span className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-saudi rtl:translate-x-1/2"><Camera className="me-1 inline size-3" />{ar ? "صورتك" : "Your photo"}</span>}
        </div>
        <div className="relative min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${alert ? "bg-warn-bg text-warn" : "bg-white text-saudi"}`}>
              {alert ? <AlertTriangle className="size-3.5" /> : <Check className="size-3.5" />}{gardenStatusLabel(p.status, ar)}
            </span>
            <span className="chip bg-white">{p.source === "store_purchase" ? <><Store className="size-3 text-saudi" />{t.space.fromStore}</> : <><Sprout className="size-3 text-saudi" />{t.space.manual}</>}</span>
          </div>
          <h2 className="mt-3 text-3xl font-bold text-forest sm:text-4xl">{p.nickname ?? p.speciesName}</h2>
          <p className="mt-1 text-muted">
            {p.nickname && p.speciesName}{p.nickname && p.scientific && <span className="mx-1.5 text-sage">•</span>}
            {p.scientific ? <bdi className="italic">{p.scientific}</bdi> : !p.nickname && t.space.unconfirmed}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {p.location && <span className="chip bg-white"><MapPin className="size-3 text-saudi" />{p.location}</span>}
            {p.lightLabel && <span className="chip bg-white"><Sun className="size-3 text-sun" />{p.lightLabel}</span>}
            <span className="chip bg-white"><CalendarClock className="size-3 text-saudi" />{t.space.addedOn} {date(p.addedAt, true)}</span>
          </div>
          {/* primary actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={onWater} disabled={watering}
              className={`btn px-5 py-3 text-white shadow-[var(--shadow-glow)] ${watering ? "bg-leaf" : "bg-gradient-to-b from-[#0a7a3f] to-saudi hover:-translate-y-0.5"}`}>
              {watering ? <Check className="size-5 animate-pop" /> : <Droplets className="size-5" />}{ar ? "سقيتها اليوم" : "Watered today"}
            </button>
            <Link href={`/nada-ai?userPlant=${p.id}`} className="btn-outline px-5 py-3"><Sparkles className="size-5" />{ar ? `اسأل ندى عن ${p.nickname ?? p.speciesName}` : `Ask Nada about ${p.nickname ?? p.speciesName}`}</Link>
            <button type="button" onClick={() => setLogOpen((v) => !v)} aria-expanded={logOpen} className="btn-light px-4 py-3 ring-1 ring-saudi/10"><NotebookPen className="size-4" />{t.plant.log}</button>
          </div>
          {logOpen && <div className="mt-4 animate-settle rounded-2xl bg-white p-4 ring-1 ring-saudi/10"><CareLogForm plantId={p.id} /></div>}
        </div>
      </header>

      {/* care stats */}
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 sm:px-8 lg:grid-cols-6">
        <Stat icon={Droplets} label={t.space.lastWatered} value={p.lastWatered ? (wateredToday ? (ar ? "اليوم" : "Today") : date(p.lastWatered)) : t.space.noWatering} tone={p.status === "no_watering_recorded" ? "warn" : "default"} />
        <Stat icon={CalendarClock} label={ar ? "فحص التربة القادم" : "Next soil check"} tone={nextCheck === 0 ? "warn" : "default"}
          value={nextCheck === null ? (ar ? "سجّل أول ري" : "Log a watering") : nextCheck === 0 ? (ar ? "اليوم" : "Today") : ar ? `بعد ${dayCount(nextCheck, "ar")}` : `In ${dayCount(nextCheck, "en")}`} />
        <Stat icon={Sun} label={ar ? "الإضاءة المطلوبة" : "Light it needs"} value={p.needsLight.join(ar ? "، " : ", ") || "—"} tone={p.status === "light_mismatch" ? "warn" : "default"} />
        <Stat icon={Gauge} label={t.product.water} value={p.waterNeed ?? "—"} />
        <Stat icon={Waves} label={t.product.humidity} value={p.humidity ?? "—"} />
        <Stat icon={Thermometer} label={t.product.temperature} value={p.temp ?? "—"} />
      </div>

      <div className="grid gap-5 px-5 pb-6 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
        {/* checklist & warnings */}
        <section className="rounded-[1.75rem] bg-mist/70 p-5 ring-1 ring-saudi/[0.06]">
          <h3 className="flex items-center justify-between gap-2 font-bold text-forest">
            <span className="flex items-center gap-2"><ClipboardList className="size-4 text-saudi" />{t.plant.checklist}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">{checked.size}/{checklist.length}</span>
          </h3>
          <ul className="mt-3 space-y-1">
            {checklist.map((c, i) => (
              <li key={i}>
                <button type="button" aria-pressed={checked.has(i)} onClick={() => setChecked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                  className="flex w-full items-start gap-2.5 rounded-xl p-1.5 text-start text-sm transition hover:bg-white">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 transition ${checked.has(i) ? "bg-saudi text-white ring-saudi" : "bg-white ring-sage"}`}>{checked.has(i) && <Check className="size-3 animate-pop" />}</span>
                  <span className={`leading-6 ${checked.has(i) ? "text-muted line-through" : "text-ink"}`}>{c}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-5 text-muted">{t.plant.suggestedNote}</p>
          {p.problems.length > 0 && (
            <div className="mt-4 rounded-2xl bg-white p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-warn"><AlertTriangle className="size-3.5" />{t.product.problems}</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-5 text-muted">{p.problems.map((x) => <li key={x}>• {x}</li>)}</ul>
            </div>
          )}
        </section>

        {/* timeline */}
        <section className="rounded-[1.75rem] bg-white p-5 ring-1 ring-saudi/[0.08]">
          <h3 className="flex items-center gap-2 font-bold text-forest"><CalendarClock className="size-4 text-saudi" />{t.plant.history}</h3>
          {p.logs.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-mist p-4 text-sm text-muted">{t.plant.noHistory}</p>
          ) : (
            <ol className="mt-4 max-h-80 space-y-3 overflow-y-auto border-s-2 border-soft ps-5 pe-1">
              {p.logs.map((l, i) => (
                <li key={l.id} className="relative flex items-start justify-between gap-2 text-sm" style={{ animation: `settle 0.5s var(--ease-organic) ${Math.min(i, 6) * 50}ms both` }}>
                  <span className={`absolute -start-[1.65rem] top-1 grid size-4 place-items-center rounded-full ring-2 ring-white ${l.activity === "watering" ? "bg-sky-400" : l.activity === "observation" ? "bg-warn" : "bg-saudi"}`} />
                  <span>
                    <span className="font-semibold text-deep">{t.plant.activity[l.activity as keyof typeof t.plant.activity] ?? l.activity}</span>
                    <span className="text-muted"> · {date(l.occurred_at)}</span>
                    {l.notes && <span className="block text-xs leading-5 text-muted">{l.notes}</span>}
                  </span>
                  <DeleteLogButton id={l.id} />
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* notes, observations, photos */}
        <section className="rounded-[1.75rem] bg-white p-5 ring-1 ring-saudi/[0.08]">
          <h3 className="flex items-center gap-2 font-bold text-forest"><NotebookPen className="size-4 text-saudi" />{ar ? "ملاحظات وصور" : "Notes & photos"}</h3>
          <div className="mt-3 flex gap-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-soft">
              <PlantImage src={p.ownPhoto ? p.image : p.speciesImage} alt="" sizes="80px" />
              {!p.ownPhoto && <span className="absolute inset-x-0 bottom-0 bg-white/85 py-0.5 text-center text-[9px] text-muted">{ar ? "صورة النوع" : "Species photo"}</span>}
            </div>
            <div className="min-w-0 text-sm">
              {p.wateringPreference && <p className="text-muted"><Droplets className="me-1 inline size-3.5 text-saudi" />{p.wateringPreference}</p>}
              <p className={`mt-1 leading-6 ${p.notes ? "text-ink" : "text-muted"}`}>{p.notes ?? (ar ? "ما فيه ملاحظات بعد — أضفها من «تعديل»." : "No notes yet — add some via “Edit”.")}</p>
            </div>
          </div>
          {p.observations.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-forest">{t.plant.symptoms}</p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted">{p.observations.map((o, i) => <li key={i}><span className="text-deep">{date(o.date)}:</span> {o.note}</li>)}</ul>
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted"><Info className="size-3.5" />{ar ? "تقدر ترفع صورة نبتتك من «صورة نبتتي» تحت." : "Upload your own plant photo with “My plant photo” below."}</p>
        </section>

        {/* consultations & management */}
        <section className="rounded-[1.75rem] bg-white p-5 ring-1 ring-saudi/[0.08]">
          <h3 className="flex items-center gap-2 font-bold text-forest"><MessageCircle className="size-4 text-saudi" />{t.plant.consultations}</h3>
          {p.consultations.length ? (
            <ul className="mt-3 space-y-1.5 text-sm">
              {p.consultations.map((c) => (
                <li key={c.id}><Link href={`/nada-ai?userPlant=${p.id}`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-mist">
                  <Sparkles className="size-3.5 shrink-0 text-leaf" /><span className="truncate">{c.title ?? "…"}</span><span className="ms-auto shrink-0 text-xs text-muted">{date(c.updated_at)}</span>
                </Link></li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{ar ? "ما سألت ندى عن هذي النبتة بعد." : "You haven't asked Nada about this plant yet."}</p>
          )}
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2.5 text-xs font-bold text-forest">{ar ? "إدارة النبتة" : "Manage plant"}</p>
            <PlantEditor plant={{ id: p.id, nickname: p.nickname, location: p.location, light_condition: p.lightCondition, watering_preference: p.wateringPreference, notes: p.notes }} />
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <Link href={`/my-green-space/plants/${p.id}`} className="inline-flex items-center gap-1 font-semibold text-saudi hover:underline"><ExternalLink className="size-3.5" />{ar ? "صفحة النبتة الكاملة" : "Full plant page"}</Link>
              {p.productSlug && <Link href={`/products/${p.productSlug}`} className="inline-flex items-center gap-1 font-semibold text-saudi hover:underline"><Store className="size-3.5" />{t.product.care}</Link>}
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
