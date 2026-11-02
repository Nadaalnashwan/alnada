"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, HelpCircle, Search } from "lucide-react";
import { useT } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";

export interface SpeciesOption { slug: string; name_ar: string; name_en: string; scientific: string; image: string | null }

const norm = (s: string) => s.toLowerCase().replace(/[ً-ٟ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

export function AddPlantForm({ species, initialSlug }: { species: SpeciesOption[]; initialSlug?: string }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [slug, setSlug] = useState<string | null>(initialSlug ?? null);
  const [unknown, setUnknown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const results = useMemo(() => {
    const n = norm(q.trim());
    return n ? species.filter((s) => norm(`${s.name_ar} ${s.name_en} ${s.scientific}`).includes(n)).slice(0, 12) : species.slice(0, 12);
  }, [q, species]);
  const chosen = species.find((s) => s.slug === slug);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => (fd.get(k) as string | null)?.trim() || null;
    if (!slug && !unknown) { setError(t.addPlant.select); return; }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/user-plants", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speciesSlug: unknown ? null : slug, unconfirmedLabel: unknown ? get("label") : null, nickname: get("nickname"), location: get("location"),
        light_condition: get("light"), watering_preference: get("watering"), notes: get("notes"), acquired_at: get("acquired"),
      }),
    });
    setBusy(false);
    if (!res.ok) { setError(t.common.error); return; }
    const { id } = await res.json();
    router.push(`/my-green-space/plants/${id}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section className="card p-5">
        <h2 className="mb-3 font-semibold text-deep">1. {t.addPlant.select}</h2>
        <label className="relative block">
          <span className="sr-only">{t.addPlant.search}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setUnknown(false); }} placeholder={t.addPlant.search} className="input ps-9" />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t.addPlant.select}>
          {results.map((s) => (
            <button type="button" role="radio" aria-checked={slug === s.slug && !unknown} key={s.slug} onClick={() => { setSlug(s.slug); setUnknown(false); }}
              className={`relative overflow-hidden rounded-2xl border-2 text-start transition ${slug === s.slug && !unknown ? "border-saudi" : "border-line hover:border-saudi/40"}`}>
              <div className="relative aspect-square bg-soft"><PlantImage src={s.image} alt="" sizes="160px" /></div>
              <div className="p-2"><p className="truncate text-sm font-semibold text-deep">{locale === "ar" ? s.name_ar : s.name_en}</p><p className="truncate text-[11px] italic text-muted" dir="ltr">{s.scientific}</p></div>
              {slug === s.slug && !unknown && <span className="absolute end-2 top-2 grid size-6 place-items-center rounded-full bg-saudi text-white"><Check className="size-3.5" /></span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { setUnknown(true); setSlug(null); }} aria-pressed={unknown} className={`mt-4 flex w-full items-center gap-2 rounded-2xl border-2 p-3 text-sm ${unknown ? "border-saudi bg-soft" : "border-dashed border-line"}`}>
          <HelpCircle className="size-4 text-saudi" />{t.addPlant.unknown}
        </button>
        {unknown && (
          <div className="mt-3">
            <label className="block"><span className="label">{t.addPlant.unknownLabel}</span><input name="label" required minLength={2} maxLength={120} className="input" /></label>
            <p className="mt-1 text-xs text-muted">{t.addPlant.unknownHelp}</p>
          </div>
        )}
      </section>

      <section className="card h-fit space-y-4 p-5">
        <h2 className="font-semibold text-deep">2. {t.plant.environment}</h2>
        {chosen && <p className="rounded-xl bg-soft p-3 text-sm text-deep">{locale === "ar" ? chosen.name_ar : chosen.name_en} · <span className="italic" dir="ltr">{chosen.scientific}</span></p>}
        <label className="block"><span className="label">{t.addPlant.nickname}</span><input name="nickname" maxLength={60} className="input" placeholder={locale === "ar" ? "مثلاً: لولو" : "e.g. Lulu"} /></label>
        <label className="block"><span className="label">{t.addPlant.location}</span>
          <input name="location" list="locations" maxLength={80} className="input" />
          <datalist id="locations">{t.addPlant.locations.map((l) => <option key={l} value={l} />)}</datalist>
        </label>
        <label className="block"><span className="label">{t.addPlant.light}</span>
          <select name="light" className="input" defaultValue=""><option value="">—</option>{(["low", "medium", "bright_indirect", "full_sun"] as const).map((l) => <option key={l} value={l}>{t.attr.light[l]}</option>)}</select>
        </label>
        <label className="block"><span className="label">{t.addPlant.watering}</span><input name="watering" maxLength={120} className="input" placeholder={locale === "ar" ? "مثلاً: مرة بالأسبوع" : "e.g. once a week"} /></label>
        <label className="block"><span className="label">{t.addPlant.acquired}</span><input name="acquired" type="date" className="input" max={new Date().toISOString().slice(0, 10)} /></label>
        <label className="block"><span className="label">{t.addPlant.notes}</span><textarea name="notes" maxLength={1000} rows={3} className="input" /></label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? t.addPlant.saving : t.addPlant.save}</button>
      </section>
    </form>
  );
}
