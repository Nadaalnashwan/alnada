import type { Metadata } from "next";
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
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-deep">{f.q ? `«${f.q}»` : t.shop.title}</h1>
        <p className="mt-2 text-sm text-muted">{list.length} {t.shop.results} · <span className="demo-badge">{t.common.demo}</span></p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside><ShopFilters t={t} f={f} action="/shop" /></aside>
        <section aria-live="polite">
          {list.length ? <ProductGrid products={list.map((p) => toCard(p, locale))} priorityCount={4} /> : <p className="card p-10 text-center text-muted">{t.shop.noResults}</p>}
        </section>
      </div>
    </div>
  );
}
