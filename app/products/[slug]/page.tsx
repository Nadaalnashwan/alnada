import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BookOpen, Droplets, Gauge, Home, PawPrint, Ruler, Sun, Thermometer, Waves } from "lucide-react";
import { PlantImage } from "@/components/store/PlantImage";
import { Price } from "@/components/store/Price";
import { ProductActions } from "@/components/store/ProductActions";
import { ProductGrid } from "@/components/store/ProductCard";
import { toCard } from "@/lib/catalog/card";
import { getAllProducts, getCategories, getProductBySlug } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";
import type { ToxicityStatus } from "@/lib/plants/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  return p ? { title: `${p.name_ar} | ${p.name_en}`, description: p.description_ar } : { title: "المنتج" };
}

const toxTone: Record<ToxicityStatus, string> = { toxic: "bg-danger-bg text-danger", non_toxic: "bg-soft text-saudi", unknown: "bg-warn-bg text-warn" };

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const { t, locale } = await getDict();
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const s = p.species;
  const ar = locale === "ar";
  const [all, cats] = await Promise.all([getAllProducts(), getCategories()]);
  const catName = (slug: string) => { const c = cats.find((x) => x.slug === slug); return c ? (ar ? c.name_ar : c.name_en) : slug; };
  const related = all
    .filter((x) => x.id !== p.id && x.kind === p.kind && x.category_slugs.some((c) => c !== "all-plants" && p.category_slugs.includes(c)))
    .slice(0, 4);
  const lowStock = p.stock > 0 && p.stock < 8;

  return (
    <div className="container-x py-8">
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-saudi">{t.nav.home}</Link> / <Link href="/shop" className="hover:text-saudi">{t.nav.shop}</Link> / <span className="text-deep">{ar ? p.name_ar : p.name_en}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className={`relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-mist to-soft shadow-[var(--shadow-lift)] ring-[6px] ring-white sm:aspect-square ${s ? "arch" : "rounded-[2rem]"}`}>
            <PlantImage src={p.image?.url ?? null} alt={ar ? p.name_ar : p.name_en} sizes="(min-width:1024px) 50vw, 100vw" priority />
          </div>
          {p.image?.source_url && (
            <p className="mt-2 text-xs text-muted">
              {t.product.photo}: {p.image.attribution ?? "Wikimedia Commons"} · {t.product.license}: {p.image.license ?? "—"} ·{" "}
              <a href={p.image.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-saudi">Wikimedia Commons</a>
            </p>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {p.category_slugs.filter((c) => c !== "all-plants").slice(0, 4).map((c) => <Link key={c} href={`/categories/${c}`} className="chip hover:bg-saudi hover:text-white">{catName(c)}</Link>)}
          </div>
          <h1 className="mt-4 text-3xl font-bold text-forest sm:text-5xl">{ar ? p.name_ar : p.name_en}</h1>
          {s && <p className="mt-1 text-lg italic text-muted" dir="ltr">{s.scientific_name} <span className="not-italic text-sm">· {s.family}</span></p>}
          <p className="mt-4 leading-8 text-ink/80">{ar ? p.description_ar : p.description_en}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Price amount={p.price_sar} compareAt={p.compare_at_sar} locale={locale} className="text-2xl" />
            <span className="demo-badge">{t.product.demoPrice}</span>
            <span className={`text-sm font-medium ${p.stock < 1 ? "text-danger" : lowStock ? "text-warn" : "text-saudi"}`}>
              {p.stock < 1 ? t.product.outOfStock : lowStock ? `${t.product.lowStock} (${p.stock})` : t.product.inStock}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">{t.product.variant}: {ar ? p.variant_ar : p.variant_en}</p>
          <div className="mt-6"><ProductActions productId={p.id} speciesSlug={s?.slug ?? null} stock={p.stock} name={p.name_en} /></div>

          {s && (
            <>
              <h2 className="mt-10 mb-4 text-xl font-bold text-deep">{t.product.care}</h2>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { icon: Sun, k: t.product.light, v: s.light.map((l) => t.attr.light[l]).join("، ") },
                  { icon: Droplets, k: t.product.water, v: t.attr.water[s.water] },
                  { icon: Waves, k: t.product.humidity, v: t.attr.humidity[s.humidity] },
                  { icon: Thermometer, k: t.product.temperature, v: `${s.temp_min_c}–${s.temp_max_c}°C` },
                  { icon: Gauge, k: t.product.difficulty, v: t.attr.difficulty[s.difficulty] },
                  { icon: Ruler, k: t.product.size, v: t.attr.size[s.size] },
                  { icon: Home, k: t.product.placement, v: s.placement.map((x) => t.attr.placement[x]).join("، ") },
                ].map(({ icon: I, k, v }) => (
                  <div key={k} className="rounded-2xl bg-soft/70 p-3.5">
                    <dt className="flex items-center gap-1.5 text-xs text-muted"><I className="size-3.5 text-saudi" />{k}</dt>
                    <dd className="mt-1 text-sm font-semibold text-deep">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 rounded-2xl border border-line p-4">
                <h3 className="flex items-center gap-2 font-semibold text-deep"><PawPrint className="size-4 text-saudi" />{t.product.pets}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${toxTone[s.toxicity.cats]}`}>{t.product.cats}: {t.attr.tox[s.toxicity.cats]}</span>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${toxTone[s.toxicity.dogs]}`}>{t.product.dogs}: {t.attr.tox[s.toxicity.dogs]}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">
                  {s.toxicity.source_url
                    ? <>{t.product.sources}: <a className="underline" href={s.toxicity.source_url} target="_blank" rel="noopener noreferrer">{s.toxicity.source}</a> ({s.toxicity.matched_name}, {s.toxicity.verified_at})</>
                    : ar ? "لا يوجد إدراج لهذا النوع في قائمة ASPCA، لذلك لا نعتبره آمنًا للحيوانات الأليفة." : "This species is not listed by the ASPCA, so we do not treat it as pet-safe."}
                </p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-semibold text-deep">{t.product.tips}</h3>
                  <ul className="space-y-1.5 text-sm leading-6 text-ink/80">{(ar ? s.tips_ar : s.tips_en).map((x) => <li key={x} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-saudi" />{x}</li>)}</ul>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-deep"><AlertTriangle className="size-4 text-warn" />{t.product.problems}</h3>
                  <ul className="space-y-1.5 text-sm leading-6 text-ink/80">{(ar ? s.problems_ar : s.problems_en).map((x) => <li key={x} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-warn" />{x}</li>)}</ul>
                </div>
              </div>
              <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
                <BookOpen className="size-3.5" />{t.product.references}:
                <a className="underline" href={s.references[0]} target="_blank" rel="noopener noreferrer">RHS</a>
                <a className="underline" href={s.references[1]} target="_blank" rel="noopener noreferrer">Missouri Botanical Garden</a>
                {s.perenual_id && <a className="underline" href={`https://perenual.com/plant-species-database-search-finder/species/${s.perenual_id}`} target="_blank" rel="noopener noreferrer">Perenual</a>}
              </p>
            </>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="section-title mb-6">{t.product.related}</h2>
          <ProductGrid products={related.map((x) => toCard(x, locale))} row />
        </section>
      )}
    </div>
  );
}
