import Link from "next/link";
import { ArrowLeft, ArrowRight, Droplets, HeartPulse, Leaf, MessageCircle, Search, Sprout, Sun, ThermometerSun } from "lucide-react";
import { PlantImage } from "@/components/store/PlantImage";
import { ProductGrid } from "@/components/store/ProductCard";
import { toCard, type CardProduct } from "@/lib/catalog/card";
import { filterProducts } from "@/lib/catalog/filter";
import { getAllProducts, getCategories } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";
import type { ProductWithSpecies } from "@/lib/plants/types";

export const revalidate = 60;

function Section({ title, subtitle, href, products, viewAll, tone = "white", priority = 0 }: {
  title: string; subtitle?: string; href: string; products: CardProduct[]; viewAll: string; tone?: "white" | "soft"; priority?: number;
}) {
  if (products.length === 0) return null; // never render empty sections
  return (
    <section className={tone === "soft" ? "bg-soft/60 py-14" : "py-14"}>
      <div className="container-x">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">{title}</h2>
            {subtitle && <p className="mt-2 max-w-xl text-sm text-muted">{subtitle}</p>}
          </div>
          <Link href={href} className="shrink-0 text-sm font-semibold text-saudi hover:underline">{viewAll}</Link>
        </div>
        <ProductGrid products={products} priorityCount={priority} row />
      </div>
    </section>
  );
}

export default async function Home() {
  const { t, locale } = await getDict();
  const [all, categories] = await Promise.all([getAllProducts(), getCategories()]);
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const card = (list: ProductWithSpecies[], n = 4) => list.slice(0, n).map((p) => toCard(p, locale));
  const inCat = (slug: string) => filterProducts(all, { category: slug });
  const plantsOnly = all.filter((p) => p.kind === "plant");
  const used = new Set<string>();
  // Prefer products not already shown higher on the page, so sections feel distinct.
  const fresh = (list: ProductWithSpecies[], n = 4) => {
    const pick = [...list.filter((p) => !used.has(p.id)), ...list.filter((p) => used.has(p.id))].slice(0, n);
    pick.forEach((p) => used.add(p.id));
    return card(pick, n);
  };

  const hero = all.find((p) => p.slug === "monstera-deliciosa-xl") ?? all[0];
  const heroImg = hero?.image?.url?.replace("/960px-", "/1280px-") ?? null;
  const featuredCats = ["indoor", "outdoor", "cacti-succulents", "flowering", "pet-friendly", "low-light", "balcony", "gifts"]
    .map((s) => categories.find((c) => c.slug === s)).filter((c): c is NonNullable<typeof c> => !!c);

  const saudi = plantsOnly.filter((p) => p.species && (p.species.heat_tolerant || (p.species.water === "low" && p.species.humidity === "low")));
  const tips = locale === "ar"
    ? [
        { icon: Droplets, title: "اختبار الإصبع قبل الري", body: "ادخل إصبعك ٣–٥ سم في التربة؛ إذا كانت رطبة أجّل الري. أغلب النباتات تموت من زيادة الماء لا من قلته." },
        { icon: Sun, title: "اقرأ ضوء بيتك", body: "الشباك الشمالي يعطي ضوء ناعم، والجنوبي والغربي في السعودية قويان وحارّان، خصوصًا بعد العصر." },
        { icon: ThermometerSun, title: "المكيف والهواء الجاف", body: "أبعد النباتات عن هواء المكيف المباشر، وجمّع النباتات المحبة للرطوبة مع بعض." },
        { icon: Sprout, title: "التصريف أولًا", body: "اختر أصيص فيه فتحة تصريف دائمًا، وفرّغ الصحن بعد الري بربع ساعة." },
      ]
    : [
        { icon: Droplets, title: "Finger test before watering", body: "Push a finger 3–5 cm into the soil; if it's moist, wait. Most houseplants die from too much water, not too little." },
        { icon: Sun, title: "Read your home's light", body: "North windows give soft light; south and west windows in Saudi Arabia are strong and hot, especially in the afternoon." },
        { icon: ThermometerSun, title: "AC and dry air", body: "Keep plants out of direct AC drafts and group humidity lovers together." },
        { icon: Sprout, title: "Drainage first", body: "Always use a pot with a drainage hole and empty the saucer 15 minutes after watering." },
      ];

  return (
    <>
      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden">
        <div className="container-x grid items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:py-16">
          <div className="animate-rise">
            <span className="chip"><Leaf className="size-3.5" />{t.hero.eyebrow}</span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.25] text-deep sm:text-5xl lg:text-6xl">{t.tagline}</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-muted sm:text-lg">{t.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/nada-ai" className="btn-primary px-6 py-3 text-base"><MessageCircle className="size-5" />{t.hero.ctaAi}</Link>
              <Link href="/shop" className="btn-outline px-6 py-3 text-base">{t.hero.ctaShop}<Arrow className="size-4" /></Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6 text-center">
              <div><dt className="text-xs text-muted">{locale === "ar" ? "نوع نباتي" : "Species"}</dt><dd className="text-2xl font-bold text-saudi">{new Set(plantsOnly.map((p) => p.species_slug)).size}</dd></div>
              <div><dt className="text-xs text-muted">{locale === "ar" ? "قسم" : "Categories"}</dt><dd className="text-2xl font-bold text-saudi">{categories.length}</dd></div>
              <div><dt className="text-xs text-muted">{locale === "ar" ? "منتج" : "Products"}</dt><dd className="text-2xl font-bold text-saudi">{all.length}</dd></div>
            </dl>
          </div>
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)] sm:aspect-[5/5] lg:aspect-[4/5]">
              <PlantImage src={heroImg} alt={locale === "ar" ? hero.name_ar : hero.name_en} sizes="(min-width:1024px) 45vw, 100vw" priority />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-deep/50 to-transparent" />
            </div>
            <div className="card absolute -bottom-5 start-4 max-w-[17rem] p-4 animate-rise sm:start-[-1.5rem]">
              <p className="flex items-center gap-2 text-xs font-semibold text-saudi"><span className="size-2 animate-pulse-dot rounded-full bg-saudi" />{t.nav.nada}</p>
              <p className="mt-1.5 text-sm leading-6 text-deep">{locale === "ar" ? "«عندك قطة وغرفتك ضوءها خفيف؟ عندي لك خيارات آمنة من المتجر.»" : "“Low light and a cat at home? I have safe options from the store.”"}</p>
            </div>
            <DewDots />
          </div>
        </div>
      </section>

      {/* ───────────── Featured categories ───────────── */}
      <section className="py-14">
        <div className="container-x">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="section-title">{t.home.categories}</h2>
            <Link href="/categories" className="text-sm font-semibold text-saudi hover:underline">{t.home.viewAll}</Link>
          </div>
          <div className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
            {featuredCats.map((c) => (
              <Link key={c.slug} href={`/categories/${c.slug}`} className="group flex w-24 shrink-0 snap-start flex-col items-center gap-3 text-center sm:w-auto">
                <span className="relative size-24 overflow-hidden rounded-full ring-4 ring-soft transition group-hover:ring-saudi/30 sm:size-28">
                  <PlantImage src={c.image_url} alt="" sizes="112px" />
                </span>
                <span className="text-sm font-medium text-deep group-hover:text-saudi">{locale === "ar" ? c.name_ar : c.name_en}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Section title={t.home.best} href="/shop?sort=featured" products={fresh(all.filter((p) => p.is_best_seller))} viewAll={t.home.viewAll} priority={2} />
      <Section title={t.home.newArrivals} href="/shop" products={fresh(all.filter((p) => p.is_new))} viewAll={t.home.viewAll} tone="soft" />
      <Section title={t.home.indoor} href="/categories/indoor" products={fresh(inCat("indoor").filter((p) => p.kind === "plant"))} viewAll={t.home.viewAll} />
      <Section title={t.home.outdoor} href="/categories/outdoor" products={fresh(inCat("outdoor").filter((p) => p.kind === "plant"))} viewAll={t.home.viewAll} tone="soft" />
      <Section title={t.home.beginner} href="/categories/beginner" products={fresh(inCat("beginner").filter((p) => p.kind === "plant"))} viewAll={t.home.viewAll} />
      <Section title={t.home.pet} subtitle={locale === "ar" ? "مصنفة غير سامة للقطط والكلاب في قائمة ASPCA. النباتات غير المؤكدة لا تظهر هنا." : "Listed non-toxic to cats and dogs by the ASPCA. Unconfirmed plants are never shown here."}
        href="/categories/pet-friendly" products={fresh(inCat("pet-friendly").filter((p) => p.kind === "plant"))} viewAll={t.home.viewAll} tone="soft" />
      <Section title={t.home.saudi} subtitle={t.home.saudiBody} href="/categories/low-maintenance" products={fresh(saudi)} viewAll={t.home.viewAll} />
      <Section title={t.home.balcony} href="/categories/balcony" products={fresh(inCat("balcony"))} viewAll={t.home.viewAll} tone="soft" />

      {/* ───────────── Meet Nada AI ───────────── */}
      <section className="py-16">
        <div className="container-x">
          <div className="grid overflow-hidden rounded-[2rem] bg-deep text-white lg:grid-cols-2">
            <div className="p-8 sm:p-12">
              <span className="chip bg-white/10 text-soft">Meta Llama</span>
              <h2 className="mt-4 text-3xl font-bold">{t.home.meetNada}</h2>
              <p className="mt-4 max-w-lg leading-8 text-white/80">{t.home.meetNadaBody}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[{ icon: Sprout, label: t.nada.care }, { icon: HeartPulse, label: t.nada.rescue }, { icon: Search, label: t.nada.finder }].map(({ icon: I, label }) => (
                  <Link key={label} href="/nada-ai" className="rounded-2xl bg-white/10 p-4 text-sm leading-6 transition hover:bg-white/15">
                    <I className="mb-2 size-5 text-soft" />{label}
                  </Link>
                ))}
              </div>
              <Link href="/nada-ai" className="btn mt-8 bg-white text-deep hover:bg-soft">{t.hero.ctaAi}<Arrow className="size-4" /></Link>
            </div>
            <div className="relative min-h-72 bg-saudi/40 p-8 sm:p-12">
              <div className="space-y-3">
                <div className="ms-auto max-w-[85%] rounded-2xl rounded-se-sm bg-white px-4 py-3 text-sm text-deep">{locale === "ar" ? "أبي نبتة لبلكونتي بالرياض، تجيها الشمس العصر وأسافر كثير" : "A plant for my Riyadh balcony with afternoon sun — I travel a lot"}</div>
                <div className="max-w-[90%] rounded-2xl rounded-ss-sm bg-white/15 px-4 py-3 text-sm leading-7">{locale === "ar" ? "بما إن الشمس قوية العصر وتسافر كثير، اخترت لك نباتات تتحمل الحرارة والعطش من متجرنا:" : "With strong afternoon sun and frequent travel, here are heat- and drought-tolerant plants from our store:"}</div>
                <div className="grid grid-cols-3 gap-2">
                  {fresh(inCat("balcony").filter((p) => p.species?.heat_tolerant && p.species.water === "low"), 3).map((p) => (
                    <div key={p.id} className="overflow-hidden rounded-xl bg-white text-deep">
                      <div className="relative aspect-square"><PlantImage src={p.image} alt={p.name} sizes="120px" /></div>
                      <p className="truncate px-2 py-1.5 text-xs font-semibold">{p.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── My Green Space preview ───────────── */}
      <section className="py-10">
        <div className="container-x grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 grid grid-cols-2 gap-4 lg:order-1">
            {fresh(plantsOnly.filter((p) => p.species?.habit !== "trailing"), 4).map((p, i) => (
              <div key={p.id} className={`card overflow-hidden ${i % 2 ? "translate-y-6" : ""}`}>
                <div className="relative aspect-[4/3]"><PlantImage src={p.image} alt={p.name} sizes="(min-width:1024px) 22vw, 45vw" /></div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-deep">{p.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Droplets className="size-3" />{locale === "ar" ? "سجل الري والعناية" : "Watering & care log"}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="order-1 lg:order-2">
            <span className="chip">{t.space.subtitle}</span>
            <h2 className="section-title mt-4">{t.home.spaceTitle}</h2>
            <p className="mt-4 max-w-lg leading-8 text-muted">{t.home.spaceBody}</p>
            <Link href="/my-green-space" className="btn-primary mt-7">{t.nav.space}<Arrow className="size-4" /></Link>
          </div>
        </div>
      </section>

      {/* ───────────── Care tips ───────────── */}
      <section className="py-16">
        <div className="container-x">
          <h2 className="section-title mb-8">{t.home.tips}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tips.map(({ icon: I, title, body }) => (
              <div key={title} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
                <span className="grid size-11 place-items-center rounded-full bg-soft text-saudi"><I className="size-5" /></span>
                <h3 className="mt-4 font-semibold text-deep">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Section title={t.home.featured} href="/shop" products={fresh(all.filter((p) => p.is_featured))} viewAll={t.home.viewAll} tone="soft" />
      <Section title={t.home.gifts} href="/categories/gifts" products={card(inCat("gifts"))} viewAll={t.home.viewAll} />
      <Section title={t.home.pots} href="/categories/pots" products={fresh(all.filter((p) => ["pot", "soil", "accessory"].includes(p.kind)))} viewAll={t.home.viewAll} tone="soft" />
    </>
  );
}

/** Decorative dew droplets, purely visual. */
function DewDots() {
  return (
    <div aria-hidden className="pointer-events-none absolute -end-3 -top-3 hidden sm:block">
      {[[0, 0, 14], [26, 18, 9], [6, 34, 6]].map(([x, y, s], i) => (
        <span key={i} className="absolute animate-dew rounded-full bg-gradient-to-br from-white to-soft shadow-[inset_0_-2px_4px_rgb(0_108_53/0.25)] ring-1 ring-saudi/10"
          style={{ insetInlineEnd: x, top: y, width: s * 2, height: s * 2, animationDelay: `${i * 0.6}s` }} />
      ))}
    </div>
  );
}
