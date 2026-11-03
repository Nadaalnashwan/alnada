"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CalendarClock, Camera, Check, ChevronLeft, ChevronRight, ClipboardList, Droplets, ExternalLink, Gauge, History, Info, ListChecks,
  LoaderCircle, MapPin, MessageCircle, NotebookPen, Plus, Scissors, Shovel, Sparkles, Sprout, Store, Sun, Thermometer, Waves, X,
} from "lucide-react";
import { Blob, Leaf } from "@/components/brand/Decor";
import { useT } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";
import { CARE_ACTIVITIES } from "@/lib/ai/schemas";
import { ADVICE_NOTES, SOIL_CHECK_NOTE, adviceOf, isSoilCheck } from "@/lib/green-space/care-notes";
import { careTasks, companionLines, taskProgress, type CareTask, type TaskActivity } from "@/lib/green-space/care-tasks";
import { dayCount, formatDate } from "@/lib/i18n/format";
import { CareLogForm, DeleteLogButton, PlantEditor } from "./PlantManager";
import type { AdviceKey } from "@/lib/green-space/care-notes";
import { AddPlantPot, PottedPlant, type Habit, type Size } from "./PottedPlant";

// Shelf geometry: the slot label block is 3.25rem and the list has 0.5rem bottom padding; the 0.75rem gap above
// the labels is where the shelf board sits, so every pot base rests exactly on its top surface.
const SHELF_BOTTOM = "calc(3.25rem + 0.5rem)";

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
  /** Record-based advice that is not a recurring task; the customer confirms the change themselves. */
  advice: { key: AdviceKey; text: string }[];
  succulent: boolean;
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

export interface GardenProps {
  plants: GardenPlant[];
  initialId?: string | null;
  /** "hero" renders the garden as the homepage's first screen, with `intro` beside the shelf and details collapsed until a plant is picked. */
  variant?: "page" | "hero";
  intro?: React.ReactNode;
  /** Sample plants from the public catalogue (visitors / empty gardens): read-only, no records, never another customer's plants. */
  sample?: boolean;
  addHref?: string;
}

type Log = GardenPlant["logs"][number];
export interface LogRequest { activity: (typeof CARE_ACTIVITIES)[number]; notes?: string; key: string; success: string }

export function Garden({ plants: serverPlants, initialId, variant = "page", intro, sample = false, addHref = "/my-green-space/add" }: GardenProps) {
  const { locale } = useT();
  const ar = locale === "ar";
  const hero = variant === "hero";
  const router = useRouter();
  const valid = (id: string | null | undefined) => (id && serverPlants.some((p) => p.id === id) ? id : null);
  const [selectedId, setSelectedId] = useState<string | null>(() => valid(initialId) ?? (hero ? null : defaultPick(serverPlants)));
  const [wateringId, setWateringId] = useState<string | null>(null);
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const inflight = useRef(new Set<string>());
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (text: string, ok = true) => {
    setToast({ text, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // Logs saved in this visit are shown at once (the real rows returned by the API) until the refreshed
  // server data arrives; a fresh server snapshot is always authoritative (it also reflects deletions).
  const [added, setAdded] = useState<Record<string, Log[]>>({});
  useEffect(() => setAdded({}), [serverPlants]);
  const plants = useMemo(() => serverPlants.map((p) => withSavedLogs(p, added[p.id] ?? [])), [serverPlants, added]);
  // A plant added in the last few minutes sprouts into its pot once (client-only, so SSR markup stays stable).
  const [sproutId, setSproutId] = useState<string | null>(null);
  useEffect(() => {
    if (sample) return;
    const fresh = serverPlants.find((p) => p.addedAt && Date.now() - new Date(p.addedAt).getTime() < 5 * 60_000);
    if (!fresh) return;
    setSproutId(fresh.id);
    const t = setTimeout(() => setSproutId(null), 2200);
    return () => clearTimeout(t);
  }, [serverPlants, sample]);
  const shelfRef = useRef<HTMLUListElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const lastShown = useRef<GardenPlant | null>(null);
  const [canScroll, setCanScroll] = useState({ start: false, end: false });

  // Keep the selection valid when the server data refreshes (e.g. after removing a plant).
  useEffect(() => {
    if (selectedId ? !plants.some((p) => p.id === selectedId) : !hero && plants.length > 0) setSelectedId(hero ? null : defaultPick(plants));
  }, [plants, selectedId, hero]);

  const selected = useMemo(() => plants.find((p) => p.id === selectedId) ?? null, [plants, selectedId]);
  if (selected) lastShown.current = selected;
  const shown = selected ?? lastShown.current; // keeps content in place while the panel collapses

  const select = (id: string | null) => {
    const next = hero && id === selectedId ? null : id; // in the hero, tapping the open plant folds its details away
    setSelectedId(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("plant", next);
    else url.searchParams.delete("plant");
    window.history.replaceState(null, "", url);
    if (!next) return;
    // Bring the details into view while keeping part of the garden visible above them.
    requestAnimationFrame(() => {
      const el = detailsRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.8) window.scrollBy({ top: top - window.innerHeight * 0.4, behavior: "smooth" });
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

  /**
   * Saves one real care log. Nothing is shown as done unless Supabase accepted it; repeated clicks
   * while saving, or the same action twice on one day, never create a second record.
   */
  const logCare = async (p: GardenPlant, req: LogRequest): Promise<boolean> => {
    const key = `${p.id}:${req.key}`;
    if (inflight.current.has(key)) return false;
    if (p.logs.some((l) => l.activity === req.activity && (req.notes === undefined || l.notes === req.notes) && new Date(l.occurred_at).toDateString() === new Date().toDateString())) {
      showToast(ar ? "مسجلة اليوم من قبل ✓ ما كررناها" : "Already logged today ✓ — not added twice");
      return false;
    }
    inflight.current.add(key);
    setPendingKey(key);
    if (req.activity === "watering") setWateringId(p.id);
    try {
      const res = await fetch("/api/care-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantId: p.id, activity: req.activity, notes: req.notes ?? null }) });
      if (!res.ok) throw new Error(String(res.status));
      const { log } = (await res.json()) as { log: Log };
      setAdded((a) => ({ ...a, [p.id]: [log, ...(a[p.id] ?? [])] }));
      const after = careTasks({ waterIntervalDays: p.checkInterval, succulent: p.succulent, addedAt: p.addedAt, logs: [log, ...p.logs] });
      const allDone = taskProgress(after).due === 0 && taskProgress(careTasks({ waterIntervalDays: p.checkInterval, succulent: p.succulent, addedAt: p.addedAt, logs: p.logs })).due > 0;
      showToast(allDone ? (ar ? `كل مهام ${p.nickname ?? p.speciesName} المستحقة صارت مكتملة 🌿` : `All of ${p.nickname ?? p.speciesName}'s due tasks are done 🌿`) : req.success);
      setCelebrateId(p.id);
      setTimeout(() => setCelebrateId((c) => (c === p.id ? null : c)), 1600);
      router.refresh(); // recompute status, insights and history from Supabase
      return true;
    } catch {
      showToast(ar ? "ما قدرنا نسجلها، جرّب مرة ثانية" : "Couldn't save that — please try again", false);
      return false;
    } finally {
      inflight.current.delete(key);
      setPendingKey((k) => (k === key ? null : k));
      setTimeout(() => setWateringId((w) => (w === p.id ? null : w)), 1400);
    }
  };
  const dueCount = (p: GardenPlant) => (sample ? 0 : taskProgress(careTasks({ waterIntervalDays: p.checkInterval, succulent: p.succulent, addedAt: p.addedAt, logs: p.logs })).due);
  const detailsFor = (p: GardenPlant) => (sample
    ? <SampleDetails key={p.id} p={p} addHref={addHref} />
    : <PlantDetails key={p.id} p={p} onLog={(req) => logCare(p, req)} pendingKey={pendingKey?.startsWith(`${p.id}:`) ? pendingKey.slice(p.id.length + 1) : null} watering={wateringId === p.id} />);

  const sampleLabel = ar ? "نبتة نموذجية" : "Sample plant";
  const shelf = (
    <div className="relative min-w-0">
      {/* shelf scroll controls (only when the shelf overflows) */}
      {(canScroll.start || canScroll.end) && (
        <div className={`absolute end-0 z-30 hidden gap-1.5 sm:flex ${hero ? "-top-1" : "top-0"}`}>
          <button type="button" onClick={() => scrollBy(-1)} disabled={!canScroll.start} className="grid size-9 place-items-center rounded-full bg-white/90 text-deep shadow-sm transition hover:bg-white disabled:opacity-40" aria-label={ar ? "السابق" : "Previous"}><ChevronRight className="size-4 ltr:rotate-180" /></button>
          <button type="button" onClick={() => scrollBy(1)} disabled={!canScroll.end} className="grid size-9 place-items-center rounded-full bg-white/90 text-deep shadow-sm transition hover:bg-white disabled:opacity-40" aria-label={ar ? "التالي" : "Next"}><ChevronLeft className="size-4 ltr:rotate-180" /></button>
        </div>
      )}
      <div className="relative">
        <ul ref={shelfRef} onScroll={updateScroll}
          className={`relative z-10 flex snap-x snap-mandatory items-end gap-4 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-7 [&::-webkit-scrollbar]:hidden ${hero
            ? "px-3 pt-8 [--plant-scale:0.82] sm:px-6 sm:pt-10 sm:[--plant-scale:0.95] lg:[--plant-scale:1.02] xl:[--plant-scale:1.14]"
            : "px-5 pt-8 [--plant-scale:0.82] sm:px-10 sm:pt-12 sm:[--plant-scale:1]"}`}
          aria-label={sample ? (ar ? "نباتات نموذجية" : "Sample plants") : ar ? "نباتاتي" : "My plants"}>
          {plants.map((p, i) => (
            <PottedPlant key={p.id} index={i} id={p.id} image={p.image} label={p.nickname ?? p.speciesName}
              sublabel={sample ? sampleLabel : p.nickname ? p.speciesName : (p.location ?? "")}
              status={p.status} statusLabel={sample ? sampleLabel : gardenStatusLabel(p.status, ar)}
              selected={p.id === selectedId} watering={p.id === wateringId} celebrate={p.id === celebrateId || p.id === sproutId} sprouting={p.id === sproutId} due={dueCount(p)} onSelect={() => select(p.id)} />
          ))}
          <AddPlantPot index={plants.length} href={addHref} label={sample ? (ar ? "ازرع نبتتك" : "Plant yours") : ar ? "أضف نبتة" : "Add a plant"}
            hint={sample ? (ar ? "ابدأ مساحتك الخضراء" : "Start your Green Space") : ar ? "ازرع نبتة جديدة" : "Plant a new one"} />
          <li aria-hidden className="w-2 shrink-0" />
        </ul>
        {/* soft edge fades hint that the shelf scrolls; opaque at the outer edge: RTL start = right, end = left */}
        {canScroll.start && <span aria-hidden className="pointer-events-none absolute inset-y-0 start-0 z-20 w-10 bg-gradient-to-r from-transparent to-[#e4f0e3] ltr:bg-gradient-to-l" />}
        {canScroll.end && <span aria-hidden className="pointer-events-none absolute inset-y-0 end-0 z-20 w-10 bg-gradient-to-l from-transparent to-[#e4f0e3] ltr:bg-gradient-to-r" />}
        {/* the shelf the pots stand on: a light oak board with a soft front edge and a natural cast shadow */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-0 h-3" style={{ bottom: SHELF_BOTTOM }}>
          <div className="mx-1 h-full rounded-[0.6rem] bg-[linear-gradient(180deg,#efe3c8_0%,#e2d0ad_55%,#cfb98f_100%)] shadow-[0_18px_24px_-14px_rgb(70_52_28/0.45),inset_0_1px_0_rgb(255_255_255/0.7)] sm:mx-3" />
          <div className="mx-5 h-3 rounded-b-[2rem] bg-[radial-gradient(60%_100%_at_50%_0%,rgb(70_52_28/0.14),transparent)] sm:mx-10" />
        </div>
      </div>
      <p className={`relative z-10 pb-5 pt-2 text-center text-[11px] text-muted ${hero ? "px-2" : "px-6 sm:px-10"}`}>
        {sample
          ? (ar ? "نباتات نموذجية من متجرنا — اضغط على أي نبتة لتتعرف على عنايتها" : "Sample plants from our store — tap any plant to see its care")
          : ar ? "اضغط على أي نبتة لعرض تفاصيلها وسجل عنايتها" : "Tap any plant to see its details and care history"}
      </p>
    </div>
  );

  return (
    <div>
      {/* The shared garden wall + shelf */}
      <section aria-label={sample ? (ar ? "حديقة نموذجية" : "Sample garden") : ar ? "حديقتي" : "My garden"}
        className={`relative overflow-clip bg-garden ${hero
          ? "-mt-[5.25rem] rounded-b-[2.5rem] pt-[5.25rem] sm:rounded-b-[3.5rem]"
          : "rounded-[2.5rem] shadow-[var(--shadow-card)] ring-1 ring-[#e7dfcc]"}`}>
        {/* window light & leaf shadows */}
        <span aria-hidden className="pointer-events-none absolute -top-24 start-[8%] h-80 w-[26rem] rotate-[-14deg] rounded-[3rem] bg-gradient-to-b from-white/90 to-transparent blur-2xl" />
        <span aria-hidden className="pointer-events-none absolute -top-10 end-[12%] h-64 w-40 rotate-12 rounded-[2rem] bg-white/50 blur-xl" />
        {hero && <span aria-hidden className="pointer-events-none absolute -end-32 top-10 size-[30rem] animate-breathe rounded-full bg-[radial-gradient(closest-side,rgb(255_214_120/0.3),transparent)]" />}
        {hero && <Blob variant={2} className="pointer-events-none absolute -start-40 bottom-[-12rem] size-[34rem] text-[#d4e9d2]/70" />}
        {hero && <Blob variant={3} className="pointer-events-none absolute end-[30%] -top-40 size-[22rem] text-white/45" />}
        {hero && <DewField />}
        <Leaf className="pointer-events-none absolute end-[6%] top-4 h-40 w-20 rotate-[24deg] text-saudi/[0.05] blur-[1px]" />
        <Leaf className="pointer-events-none absolute end-[14%] top-14 h-28 w-14 -rotate-[18deg] text-saudi/[0.04] blur-[1px]" />
        <Leaf className="pointer-events-none absolute start-[30%] -top-6 h-32 w-16 rotate-[160deg] text-saudi/[0.04] blur-[1px]" />

        {hero ? (
          <div className="container-x relative grid items-center gap-0 pt-4 sm:pt-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.55fr)] lg:gap-6 lg:pb-6 lg:pt-10">
            <div className="relative z-10">{intro}</div>
            {shelf}
          </div>
        ) : (
          <div className="relative pt-0">{shelf}</div>
        )}
      </section>

      {/* toast */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && <p className={`animate-pop rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-lift)] ${toast.ok ? "bg-forest" : "bg-danger"}`}>{toast.text}</p>}
      </div>

      {/* Details of the selected plant — in the hero they unfold below the garden only once a plant is picked */}
      <div ref={detailsRef} id="plant-details" className={`scroll-mt-28 ${hero ? "container-x" : ""}`}>
        {hero ? (
          <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease-organic)] ${selected ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!selected}>
            <div className="min-h-0 overflow-hidden" inert={!selected}>
              {shown && (
                <div className="relative pb-2">
                  <button type="button" onClick={() => select(null)} className="absolute end-4 top-10 z-20 grid size-9 place-items-center rounded-full bg-white/90 text-deep shadow-sm ring-1 ring-saudi/10 transition hover:bg-white sm:end-6 sm:top-12" aria-label={ar ? "إغلاق التفاصيل" : "Close details"}><X className="size-4" /></button>
                  {detailsFor(shown)}
                </div>
              )}
            </div>
          </div>
        ) : (
          selected && detailsFor(selected)
        )}
      </div>
    </div>
  );
}

/** A few dew drops and leaves drifting in the window light — sparse, decorative, motion-safe. */
const DEW = [
  { s: 10, x: "12%", y: "18%", d: "0s", t: "16s" }, { s: 6, x: "26%", y: "62%", d: "-3s", t: "13s" }, { s: 8, x: "44%", y: "12%", d: "-7s", t: "18s" },
  { s: 5, x: "58%", y: "48%", d: "-2s", t: "12s" }, { s: 9, x: "71%", y: "24%", d: "-9s", t: "17s" }, { s: 6, x: "86%", y: "66%", d: "-5s", t: "14s" },
];
function DewField() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {DEW.map((p, i) => (
        <span key={i} className="absolute animate-drift rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-[radial-gradient(circle_at_35%_30%,#ffffff,rgb(190_230_205/0.75)_55%,rgb(0_108_53/0.18))] shadow-[0_2px_6px_rgb(0_108_53/0.15)]"
          style={{ width: p.s, height: p.s * 1.25, insetInlineStart: p.x, top: p.y, animationDelay: p.d, animationDuration: p.t, opacity: 0.75 }} />
      ))}
      <Leaf className="absolute start-[36%] top-[30%] h-6 w-3 animate-drift text-leaf/35 [animation-duration:19s]" />
      <Leaf className="absolute start-[80%] top-[12%] h-5 w-2.5 animate-drift text-saudi/25 [animation-delay:-6s] [animation-duration:22s]" />
    </span>
  );
}

/** Server data plus logs saved during this visit; watering/soil-check statuses follow those real records. */
function withSavedLogs(p: GardenPlant, extra: Log[]): GardenPlant {
  const fresh = extra.filter((l) => !p.logs.some((x) => x.id === l.id));
  if (!fresh.length) return p;
  const logs = [...fresh, ...p.logs].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const lastWatered = logs.find((l) => l.activity === "watering")?.occurred_at ?? null;
  const watered = fresh.some((l) => l.activity === "watering");
  const checked = watered || fresh.some(isSoilCheck);
  const status: GardenStatus = (checked && p.status === "soil_check_due") || (watered && p.status === "no_watering_recorded") ? "on_track" : p.status;
  return { ...p, logs, lastWatered, daysSinceWatering: lastWatered ? Math.max(0, Math.floor((Date.now() - new Date(lastWatered).getTime()) / 86_400_000)) : null, status };
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

const ACTIVITY_ICON: Record<string, typeof Sun> = { watering: Droplets, cleaning: Sparkles, fertilizing: Sprout, repotting: Shovel, pruning: Scissors, observation: NotebookPen };
const ACTIVITY_TONE: Record<string, string> = { watering: "bg-sky-100 text-sky-600", cleaning: "bg-dew text-saudi", fertilizing: "bg-[#f3ecd6] text-[#8a6a1f]", repotting: "bg-[#efe3d3] text-[#7a5a3a]", pruning: "bg-soft text-deep", observation: "bg-warn-bg text-warn" };

const TASK_TEXT: Record<TaskActivity, { ar: string; en: string; done: { ar: string; en: string } }> = {
  watering: { ar: "افحص التربة واسقها لو جفّت", en: "Check the soil, water if dry", done: { ar: "سقيتها", en: "Watered" } },
  cleaning: { ar: "امسح الغبار عن الأوراق", en: "Wipe dust off the leaves", done: { ar: "مسحت الأوراق", en: "Leaves wiped" } },
  fertilizing: { ar: "تسميد خفيف", en: "Light feeding", done: { ar: "سمّدتها", en: "Fed" } },
  repotting: { ar: "تجديد التربة أو تغيير الأصيص", en: "Refresh soil or repot", done: { ar: "غيرت الأصيص", en: "Repotted" } },
};

/** One recurring care task: ticking it saves a real care log; it only shows as done once Supabase saved it. */
function TaskRow({ task, name, pending, onDo, onSoilOk }: { task: CareTask; name: string; pending: string | null; onDo: () => void; onSoilOk?: () => void }) {
  const { locale } = useT();
  const ar = locale === "ar";
  const L = (s: { ar: string; en: string }) => (ar ? s.ar : s.en);
  const I = ACTIVITY_ICON[task.activity];
  const busy = pending === task.activity || pending === "soil";
  const done = task.state === "done";
  const when = task.daysSinceLast === null ? null : task.daysSinceLast === 0 ? (ar ? "اليوم" : "today") : ar ? `قبل ${dayCount(task.daysSinceLast, "ar")}` : `${dayCount(task.daysSinceLast, "en")} ago`;
  const next = task.dueInDays === 0 ? (ar ? "مستحقة الحين" : "Due now") : ar ? `الجاية بعد ${dayCount(task.dueInDays, "ar")}` : `Next in ${dayCount(task.dueInDays, "en")}`;
  return (
    <li className={`group flex items-center gap-3 rounded-2xl p-2.5 transition duration-300 ${done ? "bg-soft/60" : task.state === "due" ? "bg-white ring-1 ring-warn/20" : "bg-white/70"}`}>
      <button type="button" onClick={onDo} disabled={done || busy} aria-pressed={done}
        aria-label={done ? `${L(TASK_TEXT[task.activity].done)} ✓` : `${L(TASK_TEXT[task.activity])} — ${ar ? "سجّلها كمنجزة" : "mark as done"}`}
        className={`relative grid size-9 shrink-0 place-items-center rounded-full ring-2 transition duration-300 ${done ? "bg-saudi text-white ring-saudi" : "bg-white text-saudi ring-sage hover:ring-saudi hover:bg-soft active:scale-90"} disabled:cursor-default`}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : done ? <Check key="done" className="size-4 animate-pop" /> : <I className="size-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold leading-6 ${done ? "text-saudi" : "text-ink"}`}>{done ? `${task.lastVia === "soil_check" ? (ar ? "فحصت التربة وكانت رطبة" : "Soil checked, still moist") : L(TASK_TEXT[task.activity].done)} ${when ?? ""}` : L(TASK_TEXT[task.activity])}</p>
        <p className="text-[11px] leading-5 text-muted">
          {done ? next : task.state === "due" ? (when ? `${next} · ${ar ? "آخر مرة" : "last"} ${when}` : next) : next}
          {task.general && <span className="text-muted/80"> · {ar ? `إرشاد عام كل ${dayCount(task.intervalDays, "ar")}` : `general guide: every ${dayCount(task.intervalDays, "en")}`}</span>}
        </p>
      </div>
      {onSoilOk && task.state === "due" && (
        <button type="button" onClick={onSoilOk} disabled={busy} title={ar ? `فحصت تربة ${name} وكانت رطبة` : `Checked ${name}'s soil and it was moist`}
          className="shrink-0 rounded-full bg-mist px-2.5 py-1.5 text-[11px] font-semibold text-deep ring-1 ring-saudi/10 transition hover:bg-soft disabled:opacity-50">
          {ar ? "التربة رطبة" : "Soil moist"}
        </button>
      )}
    </li>
  );
}

function PlantDetails({ p, onLog, pendingKey, watering }: { p: GardenPlant; onLog: (req: LogRequest) => Promise<boolean>; pendingKey: string | null; watering: boolean }) {
  const { t, locale } = useT();
  const ar = locale === "ar";
  const [logOpen, setLogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const name = p.nickname ?? p.speciesName;
  const alert = p.status === "soil_check_due" || p.status === "light_mismatch";
  const tasks = useMemo(() => careTasks({ waterIntervalDays: p.checkInterval, succulent: p.succulent, addedAt: p.addedAt, logs: p.logs }), [p]);
  const progress = taskProgress(tasks);
  const lines = companionLines(name, tasks, p.logs, p.addedAt, locale);
  const wateredToday = p.logs.some((l) => l.activity === "watering" && new Date(l.occurred_at).toDateString() === new Date().toDateString());
  const date = (iso: string, withYear = false) => formatDate(iso, locale, withYear ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long" });
  const confirmations = new Map(p.logs.flatMap((l) => { const k = adviceOf(l); return k ? [[k, l.occurred_at] as const] : []; }).reverse());
  // Joining the garden and every care log, in date order (logs can be back-dated before the plant was added).
  const journey = [
    ...(p.addedAt ? [{ id: "joined", activity: "joined", occurred_at: p.addedAt, notes: null }] : []),
    ...p.logs,
  ].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).slice(-7);
  const actLabel = (a: string) => t.plant.activity[a as keyof typeof t.plant.activity] ?? a;

  const doTask = (task: CareTask) => onLog({
    activity: task.activity, key: task.activity,
    success: task.activity === "watering" ? (ar ? `تم! سجلنا ري ${name} 💧` : `Done! Watering logged for ${name} 💧`) : (ar ? `تمام! سجلنا ${actLabel(task.activity)} لـ${name} 🌿` : `Nice! ${actLabel(task.activity)} logged for ${name} 🌿`),
  });
  const soilOk = () => onLog({ activity: "observation", notes: ar ? SOIL_CHECK_NOTE.ar : SOIL_CHECK_NOTE.en, key: "soil", success: ar ? `حلو! سجلنا إن تربة ${name} رطبة وما احتاجت ري` : `Got it — ${name}'s soil was still moist` });

  return (
    <article className="relative mt-6 animate-settle overflow-hidden rounded-[2.25rem] bg-white shadow-[var(--shadow-lift)] ring-1 ring-saudi/[0.08]" aria-label={name}>
      {/* header: who this plant is, what the records say, and the main actions */}
      <header className="relative grid gap-5 bg-garden p-5 sm:grid-cols-[auto_1fr] sm:gap-7 sm:p-7">
        <Leaf className="pointer-events-none absolute end-6 top-4 h-32 w-16 rotate-12 text-saudi/[0.06]" />
        <div className="relative mx-auto aspect-[4/5] w-36 overflow-hidden rounded-t-full rounded-b-[1.4rem] bg-soft shadow-[var(--shadow-lift)] ring-[5px] ring-white sm:mx-0 sm:w-40">
          <PlantImage src={p.image} alt={name} sizes="160px" className="object-[center_40%]" />
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
            {p.location && <span className="chip bg-white"><MapPin className="size-3 text-saudi" />{p.location}</span>}
          </div>
          <h2 className="mt-3 text-3xl font-bold text-forest sm:text-[2.2rem]">{name}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {p.nickname && p.speciesName}{p.nickname && p.scientific && <span className="mx-1.5 text-sage">•</span>}
            {p.scientific ? <bdi className="italic">{p.scientific}</bdi> : !p.nickname && t.space.unconfirmed}
          </p>
          {/* companion lines — each one comes from saved records */}
          <ul className="mt-3 space-y-1 text-sm text-deep">
            {lines.map((l) => <li key={l} className="flex items-start gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" />{l}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => doTask(tasks[0])} disabled={watering || wateredToday || pendingKey === "watering"}
              className={`btn px-5 py-3 text-white shadow-[var(--shadow-glow)] disabled:opacity-100 ${wateredToday ? "bg-leaf" : "bg-gradient-to-b from-[#0a7a3f] to-saudi hover:-translate-y-0.5"}`}>
              {pendingKey === "watering" ? <LoaderCircle className="size-5 animate-spin" /> : wateredToday ? <Check className="size-5 animate-pop" /> : <Droplets className="size-5" />}
              {wateredToday ? (ar ? "انسقت اليوم" : "Watered today ✓") : ar ? "سقيتها اليوم" : "Watered today"}
            </button>
            <Link href={`/nada-ai?userPlant=${p.id}`} className="btn-outline px-5 py-3"><Sparkles className="size-5" />{ar ? `اسأل ندى عن ${name}` : `Ask Nada about ${name}`}</Link>
            <button type="button" onClick={() => setLogOpen((v) => !v)} aria-expanded={logOpen} className="btn-light px-4 py-3 ring-1 ring-saudi/10"><NotebookPen className="size-4" />{t.plant.log}</button>
          </div>
          {logOpen && <div className="mt-4 animate-settle rounded-2xl bg-white p-4 ring-1 ring-saudi/10"><CareLogForm plantId={p.id} /></div>}
        </div>
      </header>

      {/* compact facts */}
      <div className="flex flex-wrap gap-2 border-b border-line/70 px-5 py-3.5 text-xs sm:px-7">
        <span className={`chip ${p.status === "light_mismatch" ? "bg-warn-bg text-warn" : "bg-mist"}`}><Sun className="size-3.5 text-sun" />{p.needsLight.join(ar ? "، " : ", ") || "—"}</span>
        <span className="chip bg-mist"><Gauge className="size-3.5 text-saudi" />{t.product.water}: {p.waterNeed ?? "—"}</span>
        <span className="chip bg-mist"><Waves className="size-3.5 text-saudi" />{t.product.humidity}: {p.humidity ?? "—"}</span>
        <span className="chip bg-mist"><Thermometer className="size-3.5 text-saudi" />{p.temp ?? "—"}</span>
        {p.lightLabel && <span className="chip bg-mist"><MapPin className="size-3.5 text-saudi" />{ar ? "مكانها:" : "Its spot:"} {p.lightLabel}</span>}
      </div>

      <div className="grid gap-5 p-4 sm:p-7 lg:grid-cols-[1.15fr_1fr] [&>section]:min-w-0">
        {/* recurring care tasks */}
        <section className="rounded-[1.75rem] bg-mist/70 p-4 ring-1 ring-saudi/[0.06] sm:p-5" aria-label={t.plant.checklist}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-bold text-forest"><ListChecks className="size-4 text-saudi" />{t.plant.checklist}</h3>
            <span className="text-xs font-semibold text-muted" aria-live="polite">{ar ? `${progress.done}/${progress.total} مكتملة` : `${progress.done}/${progress.total} done`}</span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <div className="h-full rounded-full bg-gradient-to-l from-leaf to-saudi transition-[width] duration-700 ease-[var(--ease-organic)]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          {progress.due === 0 && progress.total > 0 && <p className="mt-2 animate-pop text-xs font-semibold text-saudi">{ar ? `كل المهام المستحقة لـ${name} مكتملة 🌿` : `Everything due for ${name} is done 🌿`}</p>}
          <ul className="mt-3 space-y-2">
            {tasks.map((task) => <TaskRow key={task.activity} task={task} name={name} pending={pendingKey} onDo={() => doTask(task)} onSoilOk={task.activity === "watering" ? soilOk : undefined} />)}
          </ul>
          {/* advice: the customer confirms the change themselves — never assumed */}
          {p.advice.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-forest">{ar ? "نصائح تحتاج تأكيدك" : "Advice to confirm"}</p>
              {p.advice.map((a) => {
                const at = confirmations.get(a.key);
                return (
                  <div key={a.key} className={`flex items-start gap-3 rounded-2xl p-3 text-sm ${at ? "bg-soft/60" : "bg-warn-bg/60"}`}>
                    {at ? <Check className="mt-0.5 size-4 shrink-0 text-saudi" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />}
                    <div className="min-w-0 flex-1">
                      <p className="leading-6 text-ink">{a.text}</p>
                      {at ? (
                        <p className="text-[11px] text-saudi">{ar ? `أكدت إنك سويتها في ${date(at)}` : `You confirmed this on ${date(at)}`}{a.key === "light" && (ar ? " — حدّث «الإضاءة» من «تعديل» عشان يختفي التنبيه." : " — update its light under “Edit” to clear the warning.")}</p>
                      ) : (
                        <button type="button" disabled={pendingKey === `advice-${a.key}`} onClick={() => onLog({ activity: "observation", notes: ar ? ADVICE_NOTES[a.key].ar : ADVICE_NOTES[a.key].en, key: `advice-${a.key}`, success: ar ? "تمام، سجلنا التغيير في سجل نبتتك ✓" : "Noted — saved to your plant's history ✓" })}
                          className="mt-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-saudi ring-1 ring-saudi/15 transition hover:bg-saudi hover:text-white disabled:opacity-50">
                          {ar ? "سويتها ✓" : "I did this ✓"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-5 text-muted">{ar ? "كل مهمة تنحفظ في سجل العناية وتتبع فترتها. هذي اقتراحات داخل التطبيق، ما فيه إشعارات أو تذكيرات تلقائية." : "Each task is saved to the care history and follows its own interval. These are in-app suggestions — no notifications or automatic reminders."}</p>
        </section>

        {/* plant journey */}
        <section className="rounded-[1.75rem] bg-white p-4 ring-1 ring-saudi/[0.08] sm:p-5">
          <h3 className="flex items-center gap-2 font-bold text-forest"><History className="size-4 text-saudi" />{ar ? `رحلة ${name}` : `${name}'s journey`}</h3>
          <ol className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {journey.map((l, i) => {
              if (l.id === "joined") return (
                <li key="joined" className="flex w-20 shrink-0 flex-col items-center text-center">
                  <span className="relative grid size-11 place-items-center overflow-hidden rounded-full bg-soft ring-2 ring-white shadow-sm">
                    {p.ownPhoto ? <PlantImage src={p.image} alt="" sizes="44px" /> : <Sprout className="size-5 text-saudi" />}
                  </span>
                  <span className="mt-1.5 text-[11px] font-semibold leading-4 text-deep">{ar ? "انضمت لحديقتك" : "Joined"}</span>
                  <span className="text-[10px] text-muted">{date(l.occurred_at)}</span>
                </li>
              );
              const I = ACTIVITY_ICON[l.activity] ?? NotebookPen;
              return (
                <li key={l.id} className="flex w-20 shrink-0 flex-col items-center text-center" style={{ animation: `settle 0.5s var(--ease-organic) ${i * 50}ms both` }}>
                  <span className={`grid size-11 place-items-center rounded-full ring-2 ring-white shadow-sm ${ACTIVITY_TONE[l.activity] ?? "bg-soft text-saudi"}`}><I className="size-5" /></span>
                  <span className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-4 text-deep">{isSoilCheck(l) ? (ar ? "فحص التربة" : "Soil check") : actLabel(l.activity)}</span>
                  <span className="text-[10px] text-muted">{date(l.occurred_at)}</span>
                </li>
              );
            })}
          </ol>
          {p.logs.length === 0 ? (
            <p className="mt-2 rounded-2xl bg-mist p-3 text-sm text-muted">{ar ? "ابدأ رحلتها: سجّل أول ري من فوق." : "Start its journey: log the first watering above."}</p>
          ) : (
            <>
              <button type="button" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen} className="mt-2 text-xs font-semibold text-saudi hover:underline">
                {historyOpen ? (ar ? "إخفاء السجل الكامل" : "Hide full history") : ar ? `السجل الكامل (${p.logs.length})` : `Full history (${p.logs.length})`}
              </button>
              {historyOpen && (
                <ol className="mt-3 max-h-72 animate-settle space-y-2.5 overflow-y-auto border-s-2 border-soft ps-5 pe-1">
                  {p.logs.map((l) => (
                    <li key={l.id} className="relative flex items-start justify-between gap-2 text-sm">
                      <span className={`absolute -start-[1.6rem] top-1 size-3.5 rounded-full ring-2 ring-white ${l.activity === "watering" ? "bg-sky-400" : l.activity === "observation" ? "bg-warn" : "bg-saudi"}`} />
                      <span><span className="font-semibold text-deep">{actLabel(l.activity)}</span><span className="text-muted"> · {date(l.occurred_at)}</span>{l.notes && <span className="block text-xs leading-5 text-muted">{l.notes}</span>}</span>
                      <DeleteLogButton id={l.id} />
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          {p.observations.length > 0 && (
            <div className="mt-4 rounded-2xl bg-warn-bg/50 p-3">
              <p className="text-xs font-bold text-warn">{t.plant.symptoms}</p>
              <ul className="mt-1 space-y-1 text-xs text-muted">{p.observations.map((o, i) => <li key={i}><span className="text-deep">{date(o.date)}:</span> {o.note}</li>)}</ul>
            </div>
          )}
        </section>

        {/* species tips & common problems */}
        {(p.tips.length > 0 || p.problems.length > 0) && (
          <section className="rounded-[1.75rem] bg-white p-4 ring-1 ring-saudi/[0.08] sm:p-5">
            <h3 className="flex items-center gap-2 font-bold text-forest"><ClipboardList className="size-4 text-saudi" />{t.product.tips}</h3>
            <ul className="mt-3 space-y-1.5 text-sm leading-6 text-ink">{p.tips.map((x) => <li key={x} className="flex gap-2"><Sprout className="mt-1 size-3.5 shrink-0 text-leaf" />{x}</li>)}</ul>
            {p.problems.length > 0 && (
              <div className="mt-3 rounded-2xl bg-mist p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-warn"><AlertTriangle className="size-3.5" />{t.product.problems}</p>
                <ul className="mt-1 space-y-1 text-xs leading-5 text-muted">{p.problems.map((x) => <li key={x}>• {x}</li>)}</ul>
              </div>
            )}
          </section>
        )}

        {/* notes, consultations & management */}
        <section className="rounded-[1.75rem] bg-white p-4 ring-1 ring-saudi/[0.08] sm:p-5">
          <h3 className="flex items-center gap-2 font-bold text-forest"><NotebookPen className="size-4 text-saudi" />{ar ? "ملاحظاتك واستشاراتك" : "Notes & consultations"}</h3>
          <div className="mt-3 flex gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-soft">
              <PlantImage src={p.ownPhoto ? p.image : p.speciesImage} alt="" sizes="64px" />
              {!p.ownPhoto && <span className="absolute inset-x-0 bottom-0 bg-white/85 py-0.5 text-center text-[9px] text-muted">{ar ? "صورة النوع" : "Species photo"}</span>}
            </div>
            <div className="min-w-0 text-sm">
              {p.wateringPreference && <p className="text-muted"><Droplets className="me-1 inline size-3.5 text-saudi" />{p.wateringPreference}</p>}
              <p className={`mt-1 leading-6 ${p.notes ? "text-ink" : "text-muted"}`}>{p.notes ?? (ar ? "ما فيه ملاحظات بعد — أضفها من «تعديل»." : "No notes yet — add some via “Edit”.")}</p>
            </div>
          </div>
          {p.consultations.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {p.consultations.map((c) => (
                <li key={c.id}><Link href={`/nada-ai?userPlant=${p.id}`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-mist">
                  <MessageCircle className="size-3.5 shrink-0 text-leaf" /><span className="truncate">{c.title ?? "…"}</span><span className="ms-auto shrink-0 text-xs text-muted">{date(c.updated_at)}</span>
                </Link></li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted">{ar ? "ما سألت ندى عن هذي النبتة بعد." : "You haven't asked Nada about this plant yet."}</p>
          )}
          <div className="mt-4 border-t border-line pt-3">
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

/* ─────────────────────────── sample details ─────────────────────────── */

/** Read-only care card for a sample plant: catalogue data only, plus what the visitor unlocks with their own garden. */
function SampleDetails({ p, addHref }: { p: GardenPlant; addHref: string }) {
  const { t, locale } = useT();
  const ar = locale === "ar";
  const unlocks = ar
    ? [{ i: Droplets, l: "سجل الري بضغطة" }, { i: CalendarClock, l: "تذكير بفحص التربة حسب سجلاتك" }, { i: NotebookPen, l: "ملاحظات وصور نبتتك" }, { i: Sparkles, l: "اسأل ندى عن نبتتك باسمها" }]
    : [{ i: Droplets, l: "One-tap watering log" }, { i: CalendarClock, l: "Soil-check reminders from your records" }, { i: NotebookPen, l: "Notes and photos of your plant" }, { i: Sparkles, l: "Ask Nada about your plant by name" }];

  return (
    <article className="relative mt-6 animate-settle overflow-hidden rounded-[2.5rem] bg-white shadow-[var(--shadow-lift)] ring-1 ring-saudi/[0.08]" aria-label={p.speciesName}>
      <header className="relative grid gap-6 bg-botanical p-5 sm:grid-cols-[auto_1fr] sm:p-8">
        <Leaf className="pointer-events-none absolute end-6 top-4 h-32 w-16 rotate-12 text-saudi/[0.06]" />
        <div className="relative mx-auto aspect-[4/5] w-40 overflow-hidden arch bg-soft shadow-[var(--shadow-lift)] ring-[5px] ring-white sm:mx-0 sm:w-44">
          <PlantImage src={p.image} alt={p.speciesName} sizes="176px" />
        </div>
        <div className="relative min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-saudi"><Info className="size-3.5" />{ar ? "نبتة نموذجية من متجرنا — ليست من حديقة أحد" : "A sample plant from our store — not from anyone's garden"}</span>
          <h2 className="mt-3 text-3xl font-bold text-forest sm:text-4xl">{p.speciesName}</h2>
          {p.scientific && <p className="mt-1 text-muted"><bdi className="italic">{p.scientific}</bdi></p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={addHref} className="btn-primary px-5 py-3"><Sprout className="size-5" />{ar ? "أنشئ مساحتك الخضراء" : "Create your Green Space"}</Link>
            {p.productSlug && <Link href={`/products/${p.productSlug}`} className="btn-outline px-5 py-3"><Store className="size-4" />{ar ? "شوفها في المتجر" : "View in store"}</Link>}
            <Link href="/nada-ai" className="btn-light px-4 py-3 ring-1 ring-saudi/10"><MessageCircle className="size-4" />{t.product.askNada}</Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 sm:px-8 lg:grid-cols-5">
        <Stat icon={Sun} label={ar ? "الإضاءة المطلوبة" : "Light it needs"} value={p.needsLight.join(ar ? "، " : ", ") || "—"} />
        <Stat icon={Gauge} label={t.product.water} value={p.waterNeed ?? "—"} />
        <Stat icon={Waves} label={t.product.humidity} value={p.humidity ?? "—"} />
        <Stat icon={Thermometer} label={t.product.temperature} value={p.temp ?? "—"} />
        <Stat icon={Sprout} label={t.product.difficulty} value={p.difficulty ?? "—"} />
      </div>

      <div className="grid gap-5 px-5 pb-6 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-[1.75rem] bg-mist/70 p-5 ring-1 ring-saudi/[0.06]">
          <h3 className="flex items-center gap-2 font-bold text-forest"><ClipboardList className="size-4 text-saudi" />{t.product.tips}</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-ink">{p.tips.map((x) => <li key={x} className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-saudi" />{x}</li>)}</ul>
          {p.problems.length > 0 && (
            <div className="mt-4 rounded-2xl bg-white p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-warn"><AlertTriangle className="size-3.5" />{t.product.problems}</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-5 text-muted">{p.problems.map((x) => <li key={x}>• {x}</li>)}</ul>
            </div>
          )}
        </section>
        <section className="rounded-[1.75rem] bg-cream p-5 ring-1 ring-[#ebe2cc]">
          <h3 className="flex items-center gap-2 font-bold text-forest"><Sprout className="size-4 text-saudi" />{ar ? "في مساحتك الخضراء تقدر:" : "In your own Green Space you can:"}</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-deep">
            {unlocks.map(({ i: I, l }) => <li key={l} className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-saudi shadow-sm"><I className="size-4" /></span>{l}</li>)}
          </ul>
          <Link href={addHref} className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-saudi hover:underline"><Plus className="size-4" />{ar ? "ابدأ بأول نبتة" : "Start with your first plant"}</Link>
        </section>
      </div>
    </article>
  );
}
