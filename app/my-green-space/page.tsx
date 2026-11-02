import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Droplets, Heart, LogIn, Plus, Sparkles, Sprout } from "lucide-react";
import { Leaf } from "@/components/brand/Decor";
import { DewDrop } from "@/components/brand/Logo";
import { Garden, type GardenPlant, type GardenStatus } from "@/components/my-green-space/Garden";
import { ClearExploredButton, ExploredPlantCard, WishlistCard, type ExploredCard, type WishCard } from "@/components/my-green-space/PlantCards";
import { Pot } from "@/components/my-green-space/PottedPlant";
import { Reveal } from "@/components/ui/Reveal";
import { getAllProducts, getAllSpecies } from "@/lib/catalog/repo";
import { loadOwnedPlants } from "@/lib/green-space/data";
import { getDict } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "مساحتي الخضراء | My Green Space" };
export const dynamic = "force-dynamic";

type Tab = "plants" | "explored" | "wishlist";

/** Restrained empty state: an empty shelf with a few waiting pots. */
function EmptyShelf({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(180deg,#fbf8f1_0%,#f3eee2_100%)] px-6 pb-10 pt-12 text-center ring-1 ring-[#ebe2cc]">
      <Leaf className="pointer-events-none absolute end-[8%] top-4 h-32 w-16 rotate-[24deg] text-saudi/[0.05]" />
      <div className="relative mx-auto flex max-w-sm items-end justify-center gap-6" aria-hidden>
        {["e1", "e2", "e3"].map((id, i) => (
          <div key={id} className="flex flex-col items-center" style={{ animation: `settle 0.6s var(--ease-organic) ${i * 90}ms both` }}>
            {i === 1 && <span className="-mb-2 h-8 w-1 rounded-full bg-leaf/50" />}
            <Pot id={id} width={i === 1 ? 84 : 70} empty={i !== 1} />
          </div>
        ))}
      </div>
      <div className="mx-auto -mt-1 h-3 max-w-md rounded-full bg-gradient-to-b from-[#e8d9b9] to-[#d2bd94] shadow-[0_12px_18px_-10px_rgb(91_70_40/0.4)]" />
      <h2 className="mt-8 text-2xl font-bold text-forest">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted">{body}</p>
      {cta && <div className="mt-7 flex flex-wrap justify-center gap-2">{cta}</div>}
    </div>
  );
}

function statusOf(p: Awaited<ReturnType<typeof loadOwnedPlants>>[number]): GardenStatus {
  if (p.identification_status === "unconfirmed") return "unconfirmed";
  if (p.insights.soil_check_due) return "soil_check_due";
  if (p.insights.light_matches === false) return "light_mismatch";
  if (p.insights.no_watering_recorded) return "no_watering_recorded";
  return "on_track";
}

export default async function GreenSpacePage({ searchParams }: { searchParams: Promise<{ tab?: string; plant?: string }> }) {
  const { t, locale } = await getDict();
  const sp = await searchParams;
  const tab: Tab = (["plants", "explored", "wishlist"] as const).find((x) => x === sp.tab) ?? "plants";
  const ar = locale === "ar";
  const user = isSupabaseConfigured() ? await getUser() : null;
  const firstName = user?.fullName?.trim().split(/\s+/)[0];

  const Greeting = ({ stats }: { stats?: { owned: number; attention: number; explored: number; wishlist: number } }) => (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow"><DewDrop className="h-4 w-3" />{t.space.subtitle}</p>
        <h1 className="mt-3 text-3xl font-bold text-forest sm:text-[2.6rem] sm:leading-tight">
          {firstName ? (ar ? <>حديقة <span className="text-saudi">{firstName}</span> الصغيرة</> : <><span className="text-saudi">{firstName}</span>&apos;s little garden</>) : t.space.title}
        </h1>
      </div>
      {stats && (
        <dl className="flex flex-wrap gap-2">
          {[
            { v: stats.owned, l: t.space.myPlants, i: Sprout, tone: "bg-white text-forest" },
            { v: stats.attention, l: ar ? "تحتاج انتباهك" : "Need attention", i: Droplets, tone: stats.attention ? "bg-warn-bg text-warn" : "bg-white text-forest" },
          ].map(({ v, l, i: I, tone }) => (
            <div key={l} className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm shadow-sm ring-1 ring-saudi/10 ${tone}`}>
              <I className="size-4" /><dd className="font-bold">{v}</dd><dt className="text-xs opacity-80">{l}</dt>
            </div>
          ))}
        </dl>
      )}
    </header>
  );

  if (!isSupabaseConfigured()) return <div className="container-x py-8"><Greeting /><p className="card p-6 text-sm leading-7 text-warn">{t.auth.notConfigured}</p></div>;
  if (!user) return (
    <div className="container-x py-8">
      <Greeting />
      <EmptyShelf title={t.auth.required} body={ar ? "حديقتك الرقمية بانتظارك: نباتاتك في أصصها، سجل عنايتها، ورفيقة اسمها ندى. سجّل دخولك عشان نحفظها لك بأمان." : "Your digital garden is waiting: your plants in their pots, their care history, and a companion named Nada. Sign in so we can keep it safe."}
        cta={<><Link href="/account/login?next=/my-green-space" className="btn-primary px-6 py-3"><LogIn className="size-4" />{t.auth.signIn}</Link><Link href="/account/signup" className="btn-outline px-6 py-3">{t.auth.signUp}</Link></>} />
    </div>
  );

  const supabase = (await getSupabase())!;
  const [products, species, ownedRaw, exploredCount, wishCount, sessions] = await Promise.all([
    getAllProducts(),
    getAllSpecies(),
    loadOwnedPlants(supabase),
    supabase.from("explored_plants").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    supabase.from("wishlists").select("product_id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    supabase.from("chat_sessions").select("id, title, updated_at, context").order("updated_at", { ascending: false }).limit(60).then((r) => r.data ?? []),
  ]);

  const garden: GardenPlant[] = ownedRaw.map((p) => {
    const s = p.species;
    const sName = s ? (ar ? s.name_ar : s.name_en) : p.unconfirmed_label ?? "?";
    const status = statusOf(p);
    return {
      id: p.id, nickname: p.nickname, speciesName: sName, scientific: s?.scientific_name ?? null, speciesSlug: s?.slug ?? null,
      productSlug: s ? products.find((x) => x.species_slug === s.slug && x.kind === "plant")?.slug ?? null : null,
      image: p.photo_url ?? s?.image?.url ?? null, ownPhoto: Boolean(p.photo_url), speciesImage: s?.image?.url ?? null,
      habit: s?.habit ?? "bushy", size: s?.size ?? "medium",
      location: p.location, lightCondition: p.light_condition,
      lightLabel: p.light_condition ? t.attr.light[p.light_condition as keyof typeof t.attr.light] : null,
      needsLight: s ? s.light.map((l) => t.attr.light[l]) : [],
      waterNeed: s ? t.attr.water[s.water] : null, humidity: s ? t.attr.humidity[s.humidity] : null,
      temp: s ? `${s.temp_min_c}–${s.temp_max_c}°C` : null, difficulty: s ? t.attr.difficulty[s.difficulty] : null,
      source: p.source, addedAt: p.created_at, acquiredAt: p.acquired_at, wateringPreference: p.watering_preference, notes: p.notes,
      unconfirmed: p.identification_status === "unconfirmed", status,
      daysSinceWatering: p.insights.days_since_watering, checkInterval: p.insights.typical_check_interval_days, lastWatered: p.last_watered_at,
      suggestions: ar ? p.insights.suggestions_ar : p.insights.suggestions_en,
      tips: s ? (ar ? s.tips_ar : s.tips_en) : [], problems: s ? (ar ? s.problems_ar : s.problems_en) : [],
      observations: p.insights.recent_observations, logs: p.logs,
      consultations: sessions.filter((c) => (c.context as { focus_user_plant?: string } | null)?.focus_user_plant === p.id).slice(0, 5)
        .map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at })),
    };
  });
  const attention = garden.filter((p) => p.status === "soil_check_due" || p.status === "light_mismatch").length;

  let explored: ExploredCard[] = [];
  let wish: WishCard[] = [];
  if (tab === "explored") {
    const { data } = await supabase.from("explored_plants").select("id, reason, last_explored_at, product_id, species:plant_species(slug)").order("last_explored_at", { ascending: false });
    explored = (data ?? []).flatMap((r) => {
      const s = species.find((x) => x.slug === (r.species as unknown as { slug: string } | null)?.slug);
      if (!s) return [];
      const prod = products.find((p) => (r.product_id ? p.id === r.product_id : p.species_slug === s.slug && p.kind === "plant"));
      return [{ id: r.id, speciesSlug: s.slug, name: ar ? s.name_ar : s.name_en, scientific: s.scientific_name, image: s.image?.thumb_url ?? null, reason: r.reason, at: r.last_explored_at, productId: prod?.id ?? null, productSlug: prod?.slug ?? null }];
    });
  } else if (tab === "wishlist") {
    const { data } = await supabase.from("wishlists").select("product_id").order("created_at", { ascending: false });
    wish = (data ?? []).flatMap((r) => {
      const p = products.find((x) => x.id === r.product_id);
      return p ? [{ id: p.id, slug: p.slug, name: ar ? p.name_ar : p.name_en, scientific: p.species?.scientific_name ?? (ar ? p.variant_ar : p.variant_en), image: p.image?.thumb_url ?? null, price: p.price_sar, stock: p.stock }] : [];
    });
  }

  const tabs: { id: Tab; label: string; count: number; icon: typeof Sprout }[] = [
    { id: "plants", label: t.space.myPlants, count: garden.length, icon: Sprout },
    { id: "explored", label: t.space.explored, count: exploredCount, icon: Bookmark },
    { id: "wishlist", label: t.space.wishlist, count: wishCount, icon: Heart },
  ];

  return (
    <div className="container-x py-8">
      <Greeting stats={{ owned: garden.length, attention, explored: exploredCount, wishlist: wishCount }} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-full bg-white p-1.5 shadow-[var(--shadow-card)] ring-1 ring-saudi/10" aria-label={t.space.title}>
          {tabs.map(({ id, label, count, icon: I }) => (
            <Link key={id} href={`/my-green-space?tab=${id}`} aria-current={tab === id ? "page" : undefined} scroll={false}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition duration-300 sm:px-4 ${tab === id ? "bg-saudi text-white shadow-[var(--shadow-glow)]" : "text-deep hover:bg-soft"}`}>
              <I className="size-4" /><span className="hidden min-[400px]:inline">{label}</span>
              <span className={`grid min-w-5 place-items-center rounded-full px-1 text-[11px] ${tab === id ? "bg-white/20" : "bg-soft"}`}>{count}</span>
            </Link>
          ))}
        </nav>
        {tab === "plants" && garden.length > 0 && <Link href="/my-green-space/add" className="btn-outline hidden px-4 py-2.5 sm:inline-flex"><Plus className="size-4" />{t.space.addPlant}</Link>}
        {tab === "explored" && explored.length > 0 && <ClearExploredButton />}
      </div>

      {tab === "plants" && (garden.length ? (
        <Garden plants={garden} initialId={sp.plant ?? null} />
      ) : (
        <EmptyShelf title={t.space.emptyPlants} body={t.space.emptyPlantsBody}
          cta={<><Link href="/my-green-space/add" className="btn-primary px-6 py-3"><Sprout className="size-4" />{t.space.addPlant}</Link><Link href="/shop" className="btn-outline px-6 py-3">{t.hero.ctaShop}</Link></>} />
      ))}
      {tab === "explored" && (explored.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{explored.map((p, i) => <Reveal key={p.id} delay={(i % 4) * 70}><ExploredPlantCard p={p} /></Reveal>)}</div>
      ) : (
        <EmptyShelf title={t.space.emptyExplored} body={t.space.emptyExploredBody} cta={<Link href="/nada-ai" className="btn-primary px-6 py-3"><Sparkles className="size-4" />{t.nav.nada}</Link>} />
      ))}
      {tab === "wishlist" && (wish.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{wish.map((p, i) => <Reveal key={p.id} delay={(i % 4) * 70}><WishlistCard p={p} /></Reveal>)}</div>
      ) : (
        <EmptyShelf title={t.space.emptyWishlist} body={t.cart.emptyBody} cta={<Link href="/shop" className="btn-primary px-6 py-3">{t.hero.ctaShop}</Link>} />
      ))}
    </div>
  );
}
