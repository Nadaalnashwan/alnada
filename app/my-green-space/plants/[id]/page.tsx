import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Droplets, MapPin, MessageCircle, Sparkles, Store, Sun } from "lucide-react";
import { CareLogForm, DeleteLogButton, PlantEditor } from "@/components/my-green-space/PlantManager";
import { PlantImage } from "@/components/store/PlantImage";
import { getAllProducts } from "@/lib/catalog/repo";
import { loadOwnedPlants } from "@/lib/green-space/data";
import { getDict } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MyPlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t, locale } = await getDict();
  const ar = locale === "ar";
  const user = await getUser();
  if (!user) redirect(`/account/login?next=/my-green-space/plants/${id}`);
  const supabase = (await getSupabase())!;
  const [plant] = await loadOwnedPlants(supabase, id);
  if (!plant) notFound(); // RLS: not this user's plant
  const [{ data: logs }, { data: chats }] = await Promise.all([
    supabase.from("care_logs").select("id, activity, notes, occurred_at").eq("user_plant_id", id).order("occurred_at", { ascending: false }).limit(50),
    supabase.from("chat_sessions").select("id, title, updated_at").eq("context->>focus_user_plant", id).order("updated_at", { ascending: false }).limit(5),
  ]);
  const s = plant.species;
  const product = s ? (await getAllProducts()).find((p) => p.species_slug === s.slug && p.kind === "plant") : null;
  const sName = s ? (ar ? s.name_ar : s.name_en) : plant.unconfirmed_label ?? "?";
  const observations = (logs ?? []).filter((l) => l.activity === "observation");
  const daysSinceWater = plant.last_watered_at ? Math.floor((Date.now() - new Date(plant.last_watered_at).getTime()) / 86_400_000) : null;

  // In-app suggestions derived from saved data only (no reminders/notifications are implied).
  const suggestions: string[] = [];
  if (s) {
    const interval = { low: 14, moderate: 7, high: 4 }[s.water];
    if (daysSinceWater === null) suggestions.push(ar ? "سجّل آخر ري عشان نقدر نتابع معك" : "Log the last watering so we can follow along");
    else if (daysSinceWater >= interval) suggestions.push(ar ? `مر ${daysSinceWater} يوم على آخر ري مسجل — افحص رطوبة التربة` : `${daysSinceWater} days since the last recorded watering — check soil moisture`);
    if (s.humidity === "high") suggestions.push(ar ? "تحب الرطوبة العالية: أبعدها عن المكيف" : "Likes high humidity: keep away from AC");
    if (plant.light_condition && !s.light.includes(plant.light_condition as never)) suggestions.push(ar ? "الإضاءة المسجلة ما تطابق احتياجها؛ فكّر تغير مكانها" : "Recorded light doesn't match its needs; consider moving it");
    if (!(logs ?? []).some((l) => l.activity === "cleaning")) suggestions.push(ar ? "امسح الغبار عن الأوراق" : "Wipe dust off the leaves");
  }

  return (
    <div className="container-x py-8">
      <Link href="/my-green-space" className="text-sm text-muted hover:text-saudi">← {t.space.title}</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-soft shadow-[var(--shadow-card)]">
            <PlantImage src={plant.photo_url ?? s?.image?.url ?? null} alt={sName} sizes="(min-width:1024px) 45vw, 100vw" priority />
          </div>
          {!plant.photo_url && s?.image && <p className="mt-2 text-xs text-muted">{ar ? "صورة توضيحية للنوع" : "Illustrative species photo"} · {s.image.license}</p>}
        </div>
        <div className="space-y-6">
          <div>
            <p className="chip">{plant.source === "store_purchase" ? <><Store className="size-3" />{t.space.fromStore}</> : t.space.manual}</p>
            <h1 className="mt-3 text-3xl font-bold text-deep">{plant.nickname ?? sName}</h1>
            <p className="text-muted">{plant.nickname && `${sName} · `}<span className="italic" dir="ltr">{s?.scientific_name ?? t.space.unconfirmed}</span></p>
            <p className="mt-1 text-xs text-muted">{t.space.addedOn}: {formatDate(plant.created_at, locale)}</p>
          </div>
          <PlantEditor plant={{ id: plant.id, nickname: plant.nickname, location: plant.location, light_condition: plant.light_condition, watering_preference: plant.watering_preference, notes: plant.notes }} />
          <section className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-soft p-3"><p className="flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" />{t.space.location}</p><p className="mt-1 text-sm font-semibold text-deep">{plant.location ?? "—"}</p></div>
            <div className="rounded-2xl bg-soft p-3"><p className="flex items-center gap-1 text-xs text-muted"><Sun className="size-3" />{t.space.lightCond}</p><p className="mt-1 text-sm font-semibold text-deep">{plant.light_condition ? t.attr.light[plant.light_condition as keyof typeof t.attr.light] : "—"}</p></div>
            <div className="rounded-2xl bg-soft p-3"><p className="flex items-center gap-1 text-xs text-muted"><Droplets className="size-3" />{t.space.lastWatered}</p><p className="mt-1 text-sm font-semibold text-deep">{plant.last_watered_at ? formatDate(plant.last_watered_at, locale, { day: "numeric", month: "short" }) : t.space.noWatering}</p></div>
          </section>
          <Link href={`/nada-ai?userPlant=${plant.id}`} className="btn-primary w-full py-3"><Sparkles className="size-5" />{t.space.ask} {plant.nickname ?? sName}</Link>

          {s && (
            <section className="card p-5">
              <h2 className="mb-3 font-bold text-deep">{t.plant.checklist}</h2>
              <ul className="space-y-1.5 text-sm">{(ar ? s.tips_ar : s.tips_en).concat(t.attr.water[s.water] ? [`${t.product.water}: ${t.attr.water[s.water]} · ${t.product.light}: ${s.light.map((l) => t.attr.light[l]).join("، ")}`] : []).map((x) => <li key={x}><label className="flex gap-2"><input type="checkbox" className="mt-1 accent-saudi" />{x}</label></li>)}</ul>
              {suggestions.length > 0 && (
                <div className="mt-4 rounded-xl bg-soft/70 p-3">
                  <h3 className="text-sm font-semibold text-deep">{t.plant.suggested}</h3>
                  <ul className="mt-1 list-inside list-disc text-sm text-ink/80">{suggestions.map((x) => <li key={x}>{x}</li>)}</ul>
                  <p className="mt-2 text-[11px] text-muted">{t.plant.suggestedNote}</p>
                </div>
              )}
              {product && <Link href={`/products/${product.slug}`} className="mt-3 inline-block text-xs font-semibold text-saudi hover:underline">{t.product.care} →</Link>}
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-3 font-bold text-deep">{t.plant.log}</h2>
            <CareLogForm plantId={plant.id} />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold text-deep">{t.plant.history}</h2>
            {!logs?.length ? <p className="text-sm text-muted">{t.plant.noHistory}</p> : (
              <ol className="space-y-3 border-s-2 border-soft ps-5">
                {logs.map((l) => (
                  <li key={l.id} className="relative flex items-start justify-between gap-2 text-sm">
                    <span className="absolute -start-[1.6rem] top-1.5 size-3 rounded-full border-2 border-white bg-saudi" />
                    <span><span className="font-semibold text-deep">{formatDate(l.occurred_at, locale, { day: "numeric", month: "long" })}</span> — {t.plant.activity[l.activity as keyof typeof t.plant.activity]}{l.notes && <span className="block text-muted">{l.notes}</span>}</span>
                    <DeleteLogButton id={l.id} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          {observations.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-2 font-bold text-deep">{t.plant.symptoms}</h2>
              <ul className="space-y-1 text-sm">{observations.slice(0, 5).map((o) => <li key={o.id}><span className="text-muted">{formatDate(o.occurred_at, locale, { day: "numeric", month: "short" })}:</span> {o.notes ?? "—"}</li>)}</ul>
            </section>
          )}
          {!!chats?.length && (
            <section className="card p-5">
              <h2 className="mb-2 font-bold text-deep">{t.plant.consultations}</h2>
              <ul className="space-y-1 text-sm">{chats.map((c) => <li key={c.id} className="flex items-center gap-2"><MessageCircle className="size-3.5 text-saudi" />{c.title} <span className="text-xs text-muted">· {formatDate(c.updated_at, locale, { day: "numeric", month: "short" })}</span></li>)}</ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
