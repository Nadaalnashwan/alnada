import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
      <header className="mb-8 rounded-[2rem] bg-soft p-8">
        <h1 className="text-3xl font-bold text-deep">{locale === "ar" ? cat.name_ar : cat.name_en}</h1>
        <p className="mt-2 max-w-2xl text-muted">{locale === "ar" ? cat.description_ar : cat.description_en}</p>
        <p className="mt-3 text-sm text-muted">{list.length} {t.shop.results}</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside><ShopFilters t={t} f={f} action={`/categories/${slug}`} hideKind /></aside>
        <section aria-live="polite">
          {list.length ? <ProductGrid products={list.map((p) => toCard(p, locale))} priorityCount={4} /> : <p className="card p-10 text-center text-muted">{t.shop.noResults}</p>}
        </section>
      </div>
    </div>
  );
}
