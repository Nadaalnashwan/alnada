import type { Metadata } from "next";
import { Sprig } from "@/components/brand/Decor";
import { ShopFilters, parseFilter } from "@/components/store/ShopFilters";
import { ProductGrid } from "@/components/store/ProductCard";
import { toCard } from "@/lib/catalog/card";
import { filterProducts } from "@/lib/catalog/filter";
import { getAllProducts } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "المتجر | Shop" };

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getDict();
  const f = parseFilter(await searchParams);
  const list = filterProducts(await getAllProducts(), f);
  return (
    <div className="container-x py-10">
      <header className="relative mb-10 overflow-hidden rounded-[2.25rem] bg-botanical px-6 py-10 ring-1 ring-saudi/10 sm:px-10">
        <Sprig className="absolute -bottom-8 end-6 h-48 w-28 text-sage/50" />
        <p className="text-xs font-bold tracking-[0.18em] text-leaf">{locale === "ar" ? "مجموعة الندى" : "THE AL NADA COLLECTION"}</p>
        <h1 className="mt-2 text-3xl font-bold text-forest sm:text-4xl">{f.q ? `«${f.q}»` : t.shop.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">{list.length} {t.shop.results} <span className="demo-badge">{t.common.demo}</span></p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start"><ShopFilters t={t} f={f} action="/shop" /></aside>
        <section aria-live="polite">
          {list.length ? <ProductGrid products={list.map((p) => toCard(p, locale))} priorityCount={4} /> : <p className="rounded-[2rem] bg-mist p-12 text-center text-muted ring-1 ring-saudi/10">{t.shop.noResults}</p>}
        </section>
      </div>
    </div>
  );
}
