import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarHeart, Droplets, Gift, HeartPulse, Leaf as LeafIcon, MessageCircle, PawPrint,
  Search, ShieldCheck, Sparkles, Sprout, Sun, ThermometerSun, Flower2,
} from "lucide-react";
import { Blob, DewCluster, Leaf, Sprig } from "@/components/brand/Decor";
import { DewDrop } from "@/components/brand/Logo";
import { PlantBox } from "@/components/my-green-space/PlantBox";
import { PlantImage } from "@/components/store/PlantImage";
import { ProductCard, ProductGrid } from "@/components/store/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { toCard } from "@/lib/catalog/card";
import { filterProducts } from "@/lib/catalog/filter";
import { getAllProducts, getCategories } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";
import { formatSAR } from "@/lib/i18n/format";
import type { ProductWithSpecies } from "@/lib/plants/types";

export const revalidate = 60;

export default async function Home() {
  const { t, locale } = await getDict();
  const ar = locale === "ar";
  const [all, categories] = await Promise.all([getAllProducts(), getCategories()]);
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const bySlug = (slug: string) => all.find((p) => p.slug === slug);
  const card = (p: ProductWithSpecies) => toCard(p, locale);
  const inCat = (slug: string) => filterProducts(all, { category: slug });
  const plants = all.filter((p) => p.kind === "plant");
  const used = new Set<string>();
  // Prefer products not shown higher on the page so every section feels distinct.
  const pick = (list: ProductWithSpecies[], n: number) => {
    const out = [...list.filter((p) => !used.has(p.id)), ...list.filter((p) => used.has(p.id))].slice(0, n);
    out.forEach((p) => used.add(p.id));
    return out;
  };

  const hero = bySlug("monstera-deliciosa-xl") ?? plants[0];
  const heroSide = bySlug("jasminum-sambac") ?? plants[1];
  const heroImg = hero.image?.url?.replace("/960px-", "/1280px-") ?? null;
  used.add(hero.id);

  const featuredCats = ["indoor", "outdoor", "pet-friendly", "low-light", "cacti-succulents", "flowering", "balcony", "gifts"]
    .map((s) => categories.find((c) => c.slug === s)).filter((c): c is NonNullable<typeof c> => !!c);
  const countIn = (slug: string) => all.filter((p) => p.category_slugs.includes(slug)).length;

  const spotlight = bySlug("ficus-lyrata") ?? plants[2];
  used.add(spotlight.id);
  const collection = pick(all.filter((p) => p.is_best_seller && p.kind === "plant"), 4);
  const saudi = pick(plants.filter((p) => p.species?.heat_tolerant || (p.species?.water === "low" && p.species?.humidity === "low")), 4);
  const petSafe = pick(inCat("pet-friendly").filter((p) => p.kind === "plant"), 4);
  const newIn = pick(all.filter((p) => p.is_new), 4);
  const gift = bySlug("gift-orchid-ceramic");
  const potsHero = bySlug("ceramic-pot-white-20");
  const greenhouse = ["monstera-deliciosa", "chlorophytum-comosum", "salvia-rosmarinus"].map(bySlug).filter((p): p is ProductWithSpecies => !!p);
  const nadaPicks = inCat("balcony").filter((p) => p.species?.heat_tolerant && p.species.water === "low").slice(0, 3);

  const promises = ar
    ? ["٥٠ نوعًا نباتيًا موثقًا", "سمية الحيوانات من قائمة ASPCA", "نباتات تناسب حر السعودية", "خطة عناية شخصية مع ندى AI", "صور مرخّصة لكل نبتة", "مساحتك الخضراء الرقمية"]
    : ["50 verified species", "Pet safety from the ASPCA list", "Plants for Saudi heat", "Personal care plans with Nada AI", "Licensed photo of every plant", "Your digital green space"];

  const why = [
    { icon: BadgeCheck, title: ar ? "معلومات نباتية موثقة" : "Verified botanical data", body: ar ? "أسماء علمية صحيحة وإرشادات عناية مراجعة مع RHS وحديقة ميزوري النباتية وبيانات Perenual." : "Correct scientific names and care guidance cross-checked with RHS, Missouri Botanical Garden and Perenual." },
    { icon: PawPrint, title: ar ? "أمان حيواناتك أولًا" : "Pet safety first", body: ar ? "نعرض سمية كل نبتة للقطط والكلاب حسب ASPCA، وغير المؤكد ما نسميه آمن." : "Cat and dog toxicity from the ASPCA for every plant — unconfirmed is never called safe." },
    { icon: ThermometerSun, title: ar ? "مختارة لمناخ السعودية" : "Chosen for Saudi climate", body: ar ? "نراعي شمس العصر، الحرارة، المكيفات والهواء الجاف في كل توصية." : "Every recommendation weighs afternoon sun, heat, air conditioning and dry air." },
    { icon: HeartPulse, title: ar ? "رفيقة بعد الشراء" : "A companion after purchase", body: ar ? "سجّل الري والملاحظات، واسأل ندى عن نبتتك باسمها." : "Log watering and observations, and ask Nada about your plant by name." },
  ];

  const rituals = ar
    ? [
        { icon: Droplets, title: "اختبار الإصبع قبل الري", body: "ادخل إصبعك ٣–٥ سم في التربة؛ إذا كانت رطبة أجّل الري. أغلب النباتات تتعب من زيادة الماء لا من قلته." },
        { icon: Sun, title: "اقرأ ضوء بيتك", body: "الشباك الشمالي يعطي ضوءًا ناعمًا، والجنوبي والغربي في السعودية قويان وحارّان بعد العصر." },
        { icon: ThermometerSun, title: "المكيف والهواء الجاف", body: "أبعد النباتات عن هواء المكيف المباشر، وجمّع النباتات المحبة للرطوبة مع بعض." },
        { icon: Sprout, title: "التصريف أولًا", body: "اختر أصيصًا فيه فتحة تصريف، وفرّغ الصحن بعد الري بربع ساعة." },
      ]
    : [
        { icon: Droplets, title: "Finger test before watering", body: "Push a finger 3–5 cm into the soil; if it's moist, wait. Most plants suffer from too much water, not too little." },
        { icon: Sun, title: "Read your home's light", body: "North windows give soft light; south and west windows in Saudi Arabia are strong and hot after noon." },
        { icon: ThermometerSun, title: "AC and dry air", body: "Keep plants out of direct AC drafts and group humidity lovers together." },
        { icon: Sprout, title: "Drainage first", body: "Use a pot with a drainage hole and empty the saucer 15 minutes after watering." },
      ];

  return (
    <>
      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative -mt-[5.25rem] overflow-hidden rounded-b-[2.5rem] bg-botanical pt-[5.25rem] sm:rounded-b-[3.5rem]">
        <Blob variant={2} className="absolute -end-40 -top-40 size-[38rem] text-dew/70" />
        <Leaf className="absolute start-[46%] top-28 hidden h-28 w-14 origin-bottom animate-sway text-sprout/40 lg:block" />
        <div className="container-x relative grid items-center gap-12 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-12">
          <div>
            <p className="eyebrow animate-rise"><DewDrop className="h-4 w-3.5" />{ar ? "متجر نباتات ذكي · ندى AI مدعومة بـ Meta Llama" : "A smart plant store · Nada AI powered by Meta Llama"}</p>
            <h1 className="display mt-6 animate-rise [animation-delay:80ms]">
              {ar ? <>حياة خضراء <span className="relative inline-block bg-gradient-to-l from-leaf to-saudi bg-clip-text text-transparent">تبدأ بقطرة</span></> : <>A greener life <span className="bg-gradient-to-r from-leaf to-saudi bg-clip-text text-transparent">begins with a drop</span></>}
            </h1>
            <p className="lead mt-6 max-w-xl animate-rise [animation-delay:160ms]">{t.hero.body}</p>
            <div className="mt-9 flex animate-rise flex-wrap gap-3 [animation-delay:240ms]">
              <Link href="/nada-ai" className="btn-primary px-7 py-3.5 text-base"><span className="shine animate-shimmer" /><MessageCircle className="size-5" />{t.hero.ctaAi}</Link>
              <Link href="/shop" className="btn-outline px-7 py-3.5 text-base">{t.hero.ctaShop}<Arrow className="size-4" /></Link>
            </div>
            <dl className="mt-11 grid max-w-lg animate-rise grid-cols-3 gap-3 [animation-delay:320ms]">
              {[
                { v: new Set(plants.map((p) => p.species_slug)).size, l: ar ? "نوع نباتي موثق" : "verified species" },
                { v: categories.length, l: ar ? "قسمًا منسقًا" : "curated categories" },
                { v: all.length, l: ar ? "منتجًا (تجريبي)" : "products (demo)" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-white/70 p-3.5 ring-1 ring-saudi/10 backdrop-blur">
                  <dd className="text-2xl font-bold text-saudi sm:text-3xl">{s.v}</dd>
                  <dt className="mt-0.5 text-[11px] leading-4 text-muted sm:text-xs">{s.l}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* composition */}
          <div className="relative mx-auto w-full max-w-[34rem]">
            <div className="relative ms-auto aspect-[4/5] w-[82%] overflow-hidden arch bg-soft shadow-[var(--shadow-lift)] ring-[6px] ring-white">
              <PlantImage src={heroImg} alt={ar ? hero.name_ar : hero.name_en} sizes="(min-width:1024px) 36vw, 80vw" priority />
              <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-forest/40 to-transparent" />
            </div>
            <div className="absolute -bottom-6 start-0 w-[42%] overflow-hidden rounded-[1.75rem] bg-soft shadow-[var(--shadow-lift)] ring-[5px] ring-white sm:w-[40%]">
              <div className="relative aspect-square"><PlantImage src={heroSide?.image?.thumb_url ?? null} alt={heroSide ? (ar ? heroSide.name_ar : heroSide.name_en) : ""} sizes="240px" /></div>
            </div>
            {/* floating living cards */}
            <div className="glass absolute -start-2 top-[10%] max-w-[15.5rem] animate-float rounded-2xl p-3.5 shadow-[var(--shadow-card)] ring-1 ring-white sm:-start-8">
              <p className="flex items-center gap-2 text-[11px] font-bold text-saudi"><span className="size-2 animate-pulse-dot rounded-full bg-leaf" />{t.nav.nada}</p>
              <p className="mt-1.5 text-[13px] leading-6 text-deep">{ar ? "«غرفتك ضوءها خفيف وعندك قطة؟ عندي لك خيارات آمنة.»" : "“Dim room and a cat? I have safe picks for you.”"}</p>
            </div>
            <div className="glass absolute -end-1 bottom-[22%] animate-float-slow rounded-2xl p-3 shadow-[var(--shadow-card)] ring-1 ring-white sm:-end-6">
              <p className="flex items-center gap-2 text-xs font-semibold text-deep"><span className="grid size-8 place-items-center rounded-xl bg-soft"><Droplets className="size-4 text-saudi" /></span>
                <span>{ar ? "تذكير العناية" : "Care check"}<span className="block text-[11px] font-normal text-muted">{ar ? "افحص التربة قبل الري" : "Check soil before watering"}</span></span>
              </p>
            </div>
            <span className="absolute -top-3 end-[8%] animate-pop rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-saudi shadow-[var(--shadow-card)]"><PawPrint className="me-1 inline size-3.5" />ASPCA</span>
            <DewCluster className="absolute -top-6 start-[22%] hidden sm:block" />
          </div>
        </div>
      </section>

      {/* ══════════════════ PROMISES MARQUEE ══════════════════ */}
      <section className="overflow-hidden py-8" aria-label={ar ? "وعود الندى" : "Our promises"}>
        <div className="flex w-max animate-marquee gap-3">
          {[...promises, ...promises].map((p, i) => (
            <span key={i} className="flex items-center gap-2 rounded-full border border-saudi/10 bg-white px-5 py-2.5 text-sm font-medium text-deep shadow-sm" aria-hidden={i >= promises.length}>
              <LeafIcon className="size-4 text-leaf" />{p}
            </span>
          ))}
        </div>
      </section>

      {/* ══════════════════ CATEGORIES ══════════════════ */}
      <section className="py-12">
        <div className="container-x">
          <Reveal><SectionHeading eyebrow={ar ? "تسوّق حسب أسلوب حياتك" : "SHOP BY LIFESTYLE"} title={t.home.categories} lead={ar ? "من ركن مكتبك المظلل إلى بلكونة تضربها شمس العصر." : "From a shaded desk corner to a balcony in the afternoon sun."} href="/categories" linkLabel={t.home.viewAll} locale={locale} /></Reveal>
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
            {featuredCats.map((c, i) => (
              <Reveal key={c.slug} delay={i * 60} className="w-28 shrink-0 snap-start sm:w-auto">
                <Link href={`/categories/${c.slug}`} className="group flex flex-col items-center text-center">
                  <span className="relative aspect-[3/4] w-full overflow-hidden arch bg-soft ring-1 ring-saudi/10 transition duration-500 group-hover:-translate-y-1.5 group-hover:shadow-[var(--shadow-lift)]">
                    <PlantImage src={c.image_url} alt="" sizes="140px" className="transition duration-700 group-hover:scale-110" />
                    <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-forest/45 to-transparent" />
                    <span className="absolute inset-x-0 bottom-2.5 text-[11px] font-semibold text-white/90">{countIn(c.slug)} {t.shop.results}</span>
                  </span>
                  <span className="mt-3 text-sm font-semibold leading-5 text-deep transition group-hover:text-saudi">{ar ? c.name_ar : c.name_en}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FEATURED COLLECTION ══════════════════ */}
      <section className="py-14">
        <div className="container-x">
          <Reveal><SectionHeading eyebrow={ar ? "مختارات الندى" : "THE AL NADA EDIT"} title={ar ? "نباتات اختارها عملاؤنا" : "Plants our customers love"} href="/shop" linkLabel={t.home.viewAll} locale={locale} /></Reveal>
          <div className="grid gap-5 lg:grid-cols-[1.05fr_2fr]">
            <Reveal className="h-full">
              <Link href={`/products/${spotlight.slug}`} className="group relative flex h-full min-h-[26rem] flex-col justify-end overflow-hidden rounded-[2rem] bg-forest p-7 text-white">
                <PlantImage src={spotlight.image?.url ?? null} alt={ar ? spotlight.name_ar : spotlight.name_en} sizes="(min-width:1024px) 34vw, 100vw" className="opacity-90 transition duration-1000 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-forest via-forest/40 to-transparent" />
                <div className="relative">
                  <p className="chip bg-white/15 text-white backdrop-blur"><Sparkles className="size-3 text-sun" />{ar ? "نبتة الموسم" : "Plant of the season"}</p>
                  <h3 className="mt-3 text-3xl font-bold">{ar ? spotlight.name_ar : spotlight.name_en}</h3>
                  <p className="mt-1 text-sm italic text-white/70" dir="ltr">{spotlight.species?.scientific_name}</p>
                  <p className="mt-3 line-clamp-2 max-w-sm text-sm leading-7 text-white/80">{ar ? spotlight.description_ar : spotlight.description_en}</p>
                  <p className="mt-5 inline-flex items-center gap-3 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-forest transition group-hover:gap-4">{formatSAR(spotlight.price_sar, locale)}<Arrow className="size-4" /></p>
                </div>
              </Link>
            </Reveal>
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              {collection.map((p, i) => <Reveal key={p.id} delay={i * 70}><ProductCard p={card(p)} /></Reveal>)}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ WHY AL NADA ══════════════════ */}
      <section className="relative py-16">
        <Sprig className="absolute -start-6 top-10 hidden h-64 w-40 text-sage/50 lg:block" />
        <div className="container-x">
          <Reveal><SectionHeading align="center" eyebrow={ar ? "لماذا الندى" : "WHY AL NADA"} title={ar ? "متجر نباتات يفهم نبتتك ومكانها" : "A plant store that understands your plant and its place"} locale={locale} /></Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {why.map(({ icon: I, title, body }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className={`group relative h-full overflow-hidden rounded-[1.75rem] p-6 transition duration-500 hover:-translate-y-1 ${i % 2 ? "bg-cream ring-1 ring-[#ebe2cc]" : "bg-mist ring-1 ring-saudi/10"}`}>
                  <Blob variant={((i % 3) + 1) as 1 | 2 | 3} className="absolute -end-12 -top-12 size-40 text-white/70 transition duration-700 group-hover:scale-110" />
                  <span className="relative grid size-12 place-items-center rounded-2xl bg-white text-saudi shadow-sm transition duration-500 group-hover:rotate-[-8deg] group-hover:bg-saudi group-hover:text-white"><I className="size-6" /></span>
                  <h3 className="relative mt-5 text-lg font-bold text-forest">{title}</h3>
                  <p className="relative mt-2 text-sm leading-7 text-muted">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ NADA AI ══════════════════ */}
      <section className="px-2 py-10 sm:px-4">
        <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2.5rem] bg-forest-glow text-white">
          <Leaf className="absolute -end-10 -top-6 h-72 w-36 rotate-12 text-white/[0.04]" />
          <div className="container-x grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-20">
            <Reveal>
              <p className="chip bg-white/10 text-sprout"><Sparkles className="size-3.5" />Meta Llama</p>
              <h2 className="mt-5 text-3xl font-bold leading-tight sm:text-5xl">{ar ? <>ندى… رفيقتك <span className="text-sprout">النباتية الذكية</span></> : <>Nada, your <span className="text-sprout">smart plant companion</span></>}</h2>
              <p className="mt-5 max-w-lg leading-8 text-white/75">{t.home.meetNadaBody}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[{ icon: Sprout, label: t.nada.care }, { icon: HeartPulse, label: t.nada.rescue }, { icon: Search, label: t.nada.finder }].map(({ icon: I, label }) => (
                  <Link key={label} href="/nada-ai" className="group rounded-2xl bg-white/[0.07] p-4 text-sm leading-6 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.12]">
                    <span className="mb-3 grid size-9 place-items-center rounded-xl bg-sprout/20 text-sprout transition group-hover:scale-110"><I className="size-[1.1rem]" /></span>{label}
                  </Link>
                ))}
              </div>
              <Link href="/nada-ai" className="btn mt-9 bg-white px-6 py-3 text-forest hover:-translate-y-0.5 hover:bg-dew">{t.hero.ctaAi}<Arrow className="size-4" /></Link>
            </Reveal>
            <Reveal delay={120}>
              <div className="relative rounded-[2rem] bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur sm:p-6">
                <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-4">
                  <span className="grid size-10 place-items-center rounded-2xl bg-white/10"><DewDrop tone="dark" className="h-6 w-5" /></span>
                  <div><p className="font-semibold">{t.nada.title}</p><p className="flex items-center gap-1.5 text-xs text-sprout"><span className="size-1.5 animate-pulse-dot rounded-full bg-sprout" />{ar ? "متصلة" : "online"}</p></div>
                </div>
                <div className="space-y-3 text-sm">
                  <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-se-md bg-white px-4 py-2.5 text-deep">{ar ? "أبي نبتة لبلكونتي بالرياض، الشمس تضربها العصر وأسافر كثير" : "A plant for my Riyadh balcony with afternoon sun — I travel a lot"}</p>
                  <p className="w-fit max-w-[90%] rounded-2xl rounded-ss-md bg-white/10 px-4 py-2.5 leading-7">{ar ? "أبشر! اخترت لك نباتات تتحمل حر العصر والعطش من متجرنا:" : "Here are heat- and drought-tolerant plants from our store:"}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {nadaPicks.map((p, i) => (
                      <div key={p.id} className="animate-rise overflow-hidden rounded-2xl bg-white text-deep" style={{ animationDelay: `${300 + i * 120}ms` }}>
                        <div className="relative aspect-square"><PlantImage src={p.image?.thumb_url ?? null} alt={ar ? p.name_ar : p.name_en} sizes="140px" /></div>
                        <div className="p-2"><p className="truncate text-xs font-bold">{ar ? p.name_ar : p.name_en}</p><p className="text-[10px] text-muted">{formatSAR(p.price_sar, locale)}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════ SAUDI HOMES ══════════════════ */}
      <section className="py-14">
        <div className="container-x">
          <Reveal><SectionHeading eyebrow={ar ? "مناخنا" : "OUR CLIMATE"} title={t.home.saudi} lead={t.home.saudiBody} href="/categories/low-maintenance" linkLabel={t.home.viewAll} locale={locale} /></Reveal>
          <Reveal><ProductGrid products={saudi.map(card)} row /></Reveal>
        </div>
      </section>

      {/* ══════════════════ MY GREEN SPACE TEASER ══════════════════ */}
      <section className="py-10">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-cream px-5 py-12 ring-1 ring-[#ece4cf] sm:px-10 lg:py-16">
            <Blob variant={3} className="absolute -start-28 -bottom-28 size-[26rem] text-white/80" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
              <Reveal>
                <p className="mb-3 text-xs font-bold tracking-[0.18em] text-leaf">{ar ? "حديقتك الرقمية" : "YOUR DIGITAL GREENHOUSE"}</p>
                <h2 className="section-title">{t.home.spaceTitle}</h2>
                <p className="lead mt-4 max-w-md">{t.home.spaceBody}</p>
                <ul className="mt-6 space-y-3 text-sm text-deep">
                  {(ar ? ["كل نبتة لها صفحتها: اسمها، مكانها، وسجل عنايتها", "تذكير بفحص التربة حسب سجلاتك", "اسأل ندى عن نبتتك باسمها"] : ["Every plant gets its own profile: nickname, spot and care log", "Soil-check reminders based on your records", "Ask Nada about your plant by name"]).map((x) => (
                    <li key={x} className="flex items-start gap-3"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-saudi text-white"><BadgeCheck className="size-3.5" /></span>{x}</li>
                  ))}
                </ul>
                <Link href="/my-green-space" className="btn-primary mt-8 px-6 py-3">{t.nav.space}<Arrow className="size-4" /></Link>
              </Reveal>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {greenhouse.map((p, i) => (
                  <Reveal key={p.id} delay={i * 110} className={i === 1 ? "translate-y-6" : ""}>
                    <div className="group rounded-[1.75rem] bg-white p-2 shadow-[var(--shadow-card)]">
                      <PlantBox id={p.id + "home"} image={p.image?.thumb_url ?? null} alt={ar ? p.name_ar : p.name_en} size="sm" />
                      <div className="px-1.5 pb-1.5 pt-2.5">
                        <p className="truncate text-xs font-bold text-forest sm:text-sm">{ar ? ["لولو", "زيزي", "روزي"][i] : ["Lulu", "Zizi", "Rosie"][i]}</p>
                        <p className="truncate text-[10px] text-muted sm:text-[11px]">{ar ? p.name_ar : p.name_en}</p>
                        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-saudi"><Droplets className="size-3" />{ar ? ["سُقيت اليوم", "قبل ٣ أيام", "افحص التربة"][i] : ["Watered today", "3 days ago", "Check soil"][i]}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
                <p className="col-span-3 mt-6 text-center text-[11px] text-muted">{ar ? "مثال توضيحي لشكل مساحتك الخضراء" : "Illustrative example of your Green Space"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ PET SAFE ══════════════════ */}
      <section className="py-14">
        <div className="container-x">
          <Reveal><SectionHeading eyebrow={ar ? "لبيت فيه قطط وكلاب" : "FOR HOMES WITH PETS"} title={t.home.pet} lead={ar ? "مصنفة غير سامة للقطط والكلاب في قائمة ASPCA. النباتات غير المؤكدة لا تظهر هنا." : "Listed non-toxic to cats and dogs by the ASPCA. Unconfirmed plants never appear here."} href="/categories/pet-friendly" linkLabel={t.home.viewAll} locale={locale} /></Reveal>
          <Reveal><ProductGrid products={petSafe.map(card)} row /></Reveal>
        </div>
      </section>

      {/* ══════════════════ CARE RITUALS ══════════════════ */}
      <section className="bg-botanical py-16">
        <div className="container-x">
          <Reveal><SectionHeading eyebrow={ar ? "طقوس العناية" : "CARE RITUALS"} title={t.home.tips} href="/nada-ai" linkLabel={t.nav.nada} locale={locale} /></Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rituals.map(({ icon: I, title, body }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="group relative h-full rounded-[1.75rem] bg-white p-6 shadow-[var(--shadow-card)] transition duration-500 hover:-translate-y-1">
                  <span className="absolute end-5 top-4 text-5xl font-bold text-soft transition group-hover:text-dew">{(ar ? "١٢٣٤" : "1234")[i]}</span>
                  <span className="relative grid size-11 place-items-center rounded-2xl bg-soft text-saudi"><I className="size-5" /></span>
                  <h3 className="relative mt-5 font-bold text-forest">{title}</h3>
                  <p className="relative mt-2 text-sm leading-7 text-muted">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ NEW IN ══════════════════ */}
      {newIn.length > 0 && (
        <section className="py-14">
          <div className="container-x">
            <Reveal><SectionHeading eyebrow={ar ? "وصل حديثًا" : "JUST ARRIVED"} title={t.home.newArrivals} href="/shop" linkLabel={t.home.viewAll} locale={locale} /></Reveal>
            <Reveal><ProductGrid products={newIn.map(card)} row /></Reveal>
          </div>
        </section>
      )}

      {/* ══════════════════ GIFTS & POTS ══════════════════ */}
      <section className="py-8">
        <div className="container-x grid gap-5 md:grid-cols-2">
          {[
            { p: gift, href: "/categories/gifts", icon: Gift, eyebrow: ar ? "هدايا تعيش أطول" : "GIFTS THAT LAST", title: t.home.gifts, body: ar ? "نباتات مغلفة للإهداء مع بطاقة — بديل يدوم أكثر من الورد المقطوف." : "Gift-wrapped plants with a card — a longer-lasting alternative to cut flowers.", dark: true },
            { p: potsHero, href: "/categories/pots", icon: Flower2, eyebrow: ar ? "لكل نبتة بيت" : "A HOME FOR EVERY PLANT", title: t.home.pots, body: ar ? "أصص فخار وسيراميك، تربة مناسبة، وأدوات تسهّل العناية." : "Terracotta and ceramic pots, the right soil and tools that make care easier.", dark: false },
          ].map(({ p, href, icon: I, eyebrow, title, body, dark }) => (
            <Reveal key={href}>
              <Link href={href} className={`group relative flex min-h-72 overflow-hidden rounded-[2rem] p-7 sm:p-9 ${dark ? "bg-forest-glow text-white" : "bg-mist text-forest ring-1 ring-saudi/10"}`}>
                <div className="relative z-10 max-w-[60%]">
                  <p className={`text-xs font-bold tracking-[0.16em] ${dark ? "text-sprout" : "text-leaf"}`}><I className="me-1.5 inline size-4" />{eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-bold sm:text-3xl">{title}</h3>
                  <p className={`mt-3 text-sm leading-7 ${dark ? "text-white/75" : "text-muted"}`}>{body}</p>
                  <span className={`mt-6 inline-flex items-center gap-2 text-sm font-bold transition group-hover:gap-3 ${dark ? "text-white" : "text-saudi"}`}>{t.home.viewAll}<Arrow className="size-4" /></span>
                </div>
                {p && <div className="absolute -bottom-6 end-[-2rem] aspect-[3/4] w-[48%] overflow-hidden arch ring-[6px] ring-white/80 transition duration-700 group-hover:-translate-y-2 group-hover:rotate-[-2deg]"><PlantImage src={p.image?.thumb_url ?? null} alt="" sizes="300px" /></div>}
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════ CLOSING CTA ══════════════════ */}
      <section className="py-16">
        <div className="container-x">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-botanical px-6 py-14 text-center ring-1 ring-saudi/10">
              <Sprig className="absolute -start-4 -bottom-6 h-48 w-28 text-sage/60" />
              <Sprig className="flip-rtl absolute -end-4 -bottom-6 h-48 w-28 scale-x-[-1] text-sage/60" />
              <CalendarHeart className="mx-auto size-10 text-saudi" />
              <h2 className="section-title mx-auto mt-4 max-w-2xl">{ar ? "ما تعرف وش يناسب مكانك؟ ندى تعرف." : "Not sure what suits your space? Nada knows."}</h2>
              <p className="lead mx-auto mt-3 max-w-xl">{ar ? "قل لها عن إضاءتك وحيواناتك وميزانيتك، واختر من نباتات حقيقية في متجرنا." : "Tell her about your light, pets and budget, then choose from real plants in our store."}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/nada-ai" className="btn-primary px-7 py-3.5"><Sparkles className="size-5" />{t.hero.ctaAi}</Link>
                <Link href="/shop" className="btn-light px-7 py-3.5 ring-1 ring-saudi/10">{t.hero.ctaShop}</Link>
              </div>
              <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted"><ShieldCheck className="size-4 text-saudi" />{t.footer.demo}</p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
