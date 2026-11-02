import type { Metadata } from "next";
import Link from "next/link";
import { PlantImage } from "@/components/store/PlantImage";
import { getAllProducts, getCategories } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "الأقسام | Categories" };

export default async function CategoriesPage() {
  const { t, locale } = await getDict();
  const [cats, products] = await Promise.all([getCategories(), getAllProducts()]);
  return (
    <div className="container-x py-10">
      <h1 className="mb-2 text-3xl font-bold text-forest sm:text-4xl">{t.nav.categories}</h1>
      <p className="mb-8 text-muted">{locale === "ar" ? "اختر حسب مكانك وأسلوب حياتك — كل نبتة قد تنتمي لأكثر من قسم." : "Browse by place and lifestyle — a plant can belong to several categories."}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cats.map((c) => {
          const n = products.filter((p) => p.category_slugs.includes(c.slug)).length;
          return (
            <Link key={c.slug} href={`/categories/${c.slug}`} className="group rounded-[1.75rem] bg-white p-2 shadow-[var(--shadow-card)] ring-1 ring-saudi/[0.06] transition duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.4rem] bg-soft"><PlantImage src={c.image_url} alt="" sizes="(min-width:1024px) 25vw, 50vw" className="transition duration-700 group-hover:scale-105" /></div>
              <div className="p-4">
                <h2 className="font-semibold text-deep">{locale === "ar" ? c.name_ar : c.name_en}</h2>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{locale === "ar" ? c.description_ar : c.description_en}</p>
                <p className="mt-2 text-xs font-semibold text-saudi">{n} {t.shop.results}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
