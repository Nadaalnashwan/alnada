import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlantImage } from "@/components/store/PlantImage";
import { ShopFilters, parseFilter } from "@/components/store/ShopFilters";
import { ProductGrid } from "@/components/store/ProductCard";
import { toCard } from "@/lib/catalog/card";
import { filterProducts } from "@/lib/catalog/filter";
import { getAllProducts, getCategories } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCategories()).find((x) => x.slug === slug);
  return { title: c ? `${c.name_ar} | ${c.name_en}` : "القسم" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t, locale } = await getDict();
  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (!cat) notFound();
  const f = { ...parseFilter(await searchParams), category: slug };
  const list = filterProducts(await getAllProducts(), f);
  return (
    <div className="container-x py-10">
      <header className="relative mb-10 grid items-center gap-6 overflow-hidden rounded-[2.25rem] bg-botanical p-6 ring-1 ring-saudi/10 sm:grid-cols-[1fr_auto] sm:p-10">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-leaf">{t.nav.categories}</p>
          <h1 className="mt-2 text-3xl font-bold text-forest sm:text-4xl">{locale === "ar" ? cat.name_ar : cat.name_en}</h1>
          <p className="mt-3 max-w-2xl leading-8 text-muted">{locale === "ar" ? cat.description_ar : cat.description_en}</p>
          <p className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-saudi shadow-sm">{list.length} {t.shop.results}</p>
        </div>
        {cat.image_url && <div className="relative hidden aspect-[3/4] w-40 overflow-hidden arch shadow-[var(--shadow-lift)] ring-[5px] ring-white sm:block"><PlantImage src={cat.image_url} alt="" sizes="160px" priority /></div>}
      </header>
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start"><ShopFilters t={t} f={f} action={`/categories/${slug}`} hideKind /></aside>
        <section aria-live="polite">
          {list.length ? <ProductGrid products={list.map((p) => toCard(p, locale))} priorityCount={4} /> : <p className="card p-10 text-center text-muted">{t.shop.noResults}</p>}
        </section>
      </div>
    </div>
  );
}
