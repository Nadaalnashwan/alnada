import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarHeart, Droplets, Gift, HeartPulse, Leaf as LeafIcon, MessageCircle, PawPrint,
  Search, ShieldCheck, Sparkles, Sprout, Sun, ThermometerSun, Flower2,
} from "lucide-react";
import { Blob, Leaf, Sprig } from "@/components/brand/Decor";
import { DewDrop } from "@/components/brand/Logo";
import { Garden, type GardenPlant } from "@/components/my-green-space/Garden";
import { PlantImage } from "@/components/store/PlantImage";
import { ProductCard, ProductGrid } from "@/components/store/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { toCard } from "@/lib/catalog/card";
import { filterProducts } from "@/lib/catalog/filter";
import { getAllProducts, getCategories } from "@/lib/catalog/repo";
import { loadOwnedPlants } from "@/lib/green-space/data";
import { buildGarden, sampleGarden } from "@/lib/green-space/garden";
import type { Dict } from "@/lib/i18n/dict";
import { getDict } from "@/lib/i18n/server";
import { formatSAR } from "@/lib/i18n/format";
import type { ProductWithSpecies } from "@/lib/plants/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic"; // the hero shows the signed-in customer's own garden

/** The signed-in customer's own plants (RLS-scoped to them), or [] for visitors / on failure. */
async function loadMyGarden(products: ProductWithSpecies[], t: Dict, ar: boolean): Promise<GardenPlant[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  try {
    const [owned, sessions] = await Promise.all([
      loadOwnedPlants(supabase),
      supabase.from("chat_sessions").select("id, title, updated_at, context").order("updated_at", { ascending: false }).limit(60).then((r) => r.data ?? []),
    ]);
    return buildGarden(owned, { products, sessions, t, ar });
  } catch {
    return [];
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ plant?: string }> }) {
  const { t, locale } = await getDict();
  const ar = locale === "ar";
  const sp = await searchParams;
  const [all, categories, user] = await Promise.all([getAllProducts(), getCategories(), isSupabaseConfigured() ? getUser() : null]);
  const myGarden = user ? await loadMyGarden(all, t, ar) : [];
  // Visitors (and customers with no plants yet) get a clearly-labelled sample garden from public catalogue data only.
  const sample = myGarden.length === 0;
  const gardenPlants = sample ? sampleGarden(all, { t, ar }) : myGarden;
  const addHref = user ? "/my-green-space/add" : "/account/signup?next=/my-green-space/add";
  const firstName = user?.fullName?.trim().split(/\s+/)[0];
  const attention = myGarden.filter((p) => p.status === "soil_check_due" || p.status === "light_mismatch").length;
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

  const intro = (
    <div className="pb-2 lg:pb-10">
      {user && (
        <p className="mb-2 animate-rise text-sm font-semibold text-saudi sm:text-base">
          {firstName ? (ar ? `أهلًا ${firstName} 🌿` : `Welcome back, ${firstName} 🌿`) : (ar ? "أهلًا بك من جديد 🌿" : "Welcome back 🌿")}
        </p>
      )}
      <h1 className="animate-rise text-[2rem] font-bold leading-[1.2] tracking-tight text-forest sm:text-5xl lg:text-[3.35rem]">
        {sample
          ? (ar ? <>ادخل حديقتك… <span className="bg-gradient-to-l from-leaf to-saudi bg-clip-text text-transparent">حياة تبدأ بقطرة</span></> : <>Step into your garden, <span className="bg-gradient-to-r from-leaf to-saudi bg-clip-text text-transparent">life begins with a drop</span></>)
          : (ar ? <>حديقتك الصغيرة <span className="bg-gradient-to-l from-leaf to-saudi bg-clip-text text-transparent">بانتظارك</span></> : <>Your little garden <span className="bg-gradient-to-r from-leaf to-saudi bg-clip-text text-transparent">is waiting</span></>)}
      </h1>
      <p className="lead mt-3 max-w-xl animate-rise text-[0.95rem] leading-7 sm:mt-5 sm:text-lg sm:leading-8 [animation-delay:90ms]">
        {sample
          ? t.hero.body
          : ar ? "اضغط على أي نبتة لتشوف حالتها، سجّل الري، واسأل ندى عنها باسمها." : "Tap any plant to see how it's doing, log a watering, or ask Nada about it by name."}
      </p>
      {!sample && attention > 0 && (
        <p className="mt-3 inline-flex animate-rise items-center gap-2 rounded-full bg-warn-bg px-3.5 py-1.5 text-xs font-bold text-warn [animation-delay:120ms]">
          <Droplets className="size-3.5" />{ar ? (attention === 1 ? "نبتة وحدة تحتاج انتباهك" : `${attention} نباتات تحتاج انتباهك`) : `${attention} need${attention === 1 ? "s" : ""} your attention`}
        </p>
      )}
      <div className="mt-5 flex animate-rise flex-wrap gap-2 sm:mt-8 sm:gap-3 [animation-delay:180ms]">
        <Link href="/nada-ai" className="btn-primary px-4 py-2.5 text-sm sm:px-7 sm:py-3.5 sm:text-base lg:px-5 xl:px-6"><span className="shine animate-shimmer" /><MessageCircle className="size-5" />{t.hero.ctaAi}</Link>
        <Link href="/shop" className="btn-outline px-4 py-2.5 text-sm sm:px-7 sm:py-3.5 sm:text-base lg:px-5 xl:px-6">{t.hero.ctaShop}<Arrow className="size-4" /></Link>
      </div>
      <Link href={sample ? addHref : "/my-green-space"} className="group mt-4 inline-flex animate-rise sm:mt-5 items-center gap-2 text-sm font-bold text-saudi [animation-delay:240ms]">
        <span className="grid size-7 place-items-center rounded-full bg-white text-saudi shadow-sm ring-1 ring-saudi/10 transition group-hover:bg-saudi group-hover:text-white"><Sprout className="size-4" /></span>
        {sample ? (user ? t.space.addPlant : ar ? "أنشئ مساحتك الخضراء مجانًا" : "Create your own Green Space") : ar ? "افتح مساحتي الخضراء كاملة" : "Open my full Green Space"}
        <Arrow className="size-3.5 transition group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
      </Link>
    </div>
  );

  return (
    <>
      {/* ══════════════════ HERO — MY LIVING GARDEN ══════════════════ */}
      <Garden variant="hero" plants={gardenPlants} sample={sample} addHref={addHref} initialId={sp.plant ?? null} intro={intro} />

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
                  <span className="grid size-10 place-items-center rounded-2xl bg-white/10"><DewDrop tone="dark" className="size-8" /></span>
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
