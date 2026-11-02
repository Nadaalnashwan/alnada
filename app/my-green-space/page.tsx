import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Droplets, Heart, LogIn, Plus, Sparkles, Sprout } from "lucide-react";
import { Blob, Leaf, Sprig } from "@/components/brand/Decor";
import { DewDrop } from "@/components/brand/Logo";
import { ClearExploredButton, ExploredPlantCard, OwnedPlantCard, WishlistCard, type ExploredCard, type OwnedCard, type PlantStatus, type WishCard } from "@/components/my-green-space/PlantCards";
import { PlantBox } from "@/components/my-green-space/PlantBox";
import { Reveal } from "@/components/ui/Reveal";
import { getAllProducts, getAllSpecies } from "@/lib/catalog/repo";
import { loadOwnedPlants } from "@/lib/green-space/data";
import { getDict } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "مساحتي الخضراء | My Green Space" };
export const dynamic = "force-dynamic";

type Tab = "plants" | "explored" | "wishlist";

/** An empty greenhouse shelf: three empty pots waiting for plants. */
function Empty({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[2.25rem] bg-botanical px-6 py-14 text-center ring-1 ring-saudi/10">
      <div className="mx-auto mb-8 flex max-w-sm items-end justify-center gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`w-24 ${i === 1 ? "-translate-y-3" : ""}`}>
            <PlantBox id={`empty-${i}`} image={null} alt="" size="sm" />
          </div>
        ))}
      </div>
      <h2 className="text-2xl font-bold text-forest">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted">{body}</p>
      {cta && <div className="mt-7 flex flex-wrap justify-center gap-2">{cta}</div>}
    </div>
  );
}

function statusOf(p: Awaited<ReturnType<typeof loadOwnedPlants>>[number]): PlantStatus {
  if (p.identification_status === "unconfirmed") return "unconfirmed";
  if (p.insights.soil_check_due) return "soil_check_due";
  if (p.insights.light_matches === false) return "light_mismatch";
  if (p.insights.no_watering_recorded) return "no_watering_recorded";
  return "on_track";
}

export default async function GreenSpacePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { t, locale } = await getDict();
  const requested = (await searchParams).tab;
  const tab: Tab = (["plants", "explored", "wishlist"] as const).find((x) => x === requested) ?? "plants";
  const ar = locale === "ar";
  const user = isSupabaseConfigured() ? await getUser() : null;

  const Hero = ({ stats }: { stats?: { owned: number; attention: number; explored: number; wishlist: number } }) => (
    <header className="relative overflow-hidden rounded-[2.5rem] bg-forest-glow px-6 pb-10 pt-12 text-white sm:px-10 sm:pt-14">
      <Leaf className="absolute end-[6%] top-6 h-40 w-20 origin-bottom animate-sway text-sprout/20" />
      <Leaf className="absolute end-[14%] top-16 h-28 w-14 origin-bottom rotate-12 animate-sway text-white/[0.06] [animation-delay:1.2s]" />
      <Blob variant={1} className="absolute -bottom-40 -start-32 size-[26rem] text-white/[0.04]" />
      <div className="relative">
        <p className="chip bg-white/10 text-sprout"><DewDrop tone="dark" className="h-4 w-3.5" />{t.space.subtitle}</p>
        <h1 className="mt-4 text-3xl font-bold sm:text-5xl">{user?.fullName ? (ar ? `مساحة ${user.fullName.split(" ")[0]} الخضراء` : `${user.fullName.split(" ")[0]}'s Green Space`) : t.space.title}</h1>
        <p className="mt-3 max-w-xl leading-8 text-white/75">{ar ? "حديقتك الرقمية: كل نبتة لها صندوقها، وسجل عنايتها، ورفيقة اسمها ندى." : "Your digital garden: every plant gets its own box, its care history, and a companion named Nada."}</p>
        {stats && (
          <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: stats.owned, l: t.space.myPlants, i: Sprout },
              { v: stats.attention, l: ar ? "تحتاج انتباهك" : "Need attention", i: Droplets },
              { v: stats.explored, l: t.space.explored, i: Bookmark },
              { v: stats.wishlist, l: t.space.wishlist, i: Heart },
            ].map(({ v, l, i: I }) => (
              <div key={l} className="rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10 backdrop-blur">
                <I className="size-4 text-sprout" />
                <dd className="mt-2 text-3xl font-bold">{v}</dd>
                <dt className="text-xs text-white/65">{l}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );

  if (!isSupabaseConfigured()) return <div className="container-x py-8"><Hero /><p className="card mt-8 p-6 text-sm leading-7 text-warn">{t.auth.notConfigured}</p></div>;
  if (!user) return (
    <div className="container-x py-8">
      <Hero />
      <div className="mt-8">
        <Empty title={t.auth.required} body={t.auth.why} cta={<><Link href="/account/login?next=/my-green-space" className="btn-primary px-6 py-3"><LogIn className="size-4" />{t.auth.signIn}</Link><Link href="/account/signup" className="btn-outline px-6 py-3">{t.auth.signUp}</Link></>} />
      </div>
    </div>
  );

  const supabase = (await getSupabase())!;
  const [products, species, ownedRaw, exploredCount, wishCount] = await Promise.all([
    getAllProducts(),
    getAllSpecies(),
    loadOwnedPlants(supabase),
    supabase.from("explored_plants").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    supabase.from("wishlists").select("product_id", { count: "exact", head: true }).then((r) => r.count ?? 0),
  ]);

  const owned: OwnedCard[] = ownedRaw.map((p) => {
    const sName = p.species ? (ar ? p.species.name_ar : p.species.name_en) : p.unconfirmed_label ?? "?";
    const status = statusOf(p);
    const tips = ar ? p.insights.suggestions_ar : p.insights.suggestions_en;
    return {
      id: p.id, title: p.nickname ? `${sName} — ${p.nickname}` : sName, nickname: p.nickname, speciesName: sName, scientific: p.species?.scientific_name ?? null,
      image: p.photo_url ?? p.species?.image?.url ?? null, ownPhoto: Boolean(p.photo_url), location: p.location,
      light: p.light_condition ? t.attr.light[p.light_condition as keyof typeof t.attr.light] : null, lastWatered: p.last_watered_at,
      lastActivity: p.last_activity ? t.plant.activity[p.last_activity.activity as keyof typeof t.plant.activity] : null,
      addedAt: p.created_at, source: p.source, unconfirmed: p.identification_status === "unconfirmed",
      status, daysSinceWatering: p.insights.days_since_watering, checkInterval: p.insights.typical_check_interval_days,
      tip: tips.find((x) => !(status === "no_watering_recorded" && x === tips[0])) ?? null,
    };
  });
  const attention = owned.filter((p) => p.status === "soil_check_due" || p.status === "light_mismatch").length;

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
    { id: "plants", label: t.space.myPlants, count: owned.length, icon: Sprout },
    { id: "explored", label: t.space.explored, count: exploredCount, icon: Bookmark },
    { id: "wishlist", label: t.space.wishlist, count: wishCount, icon: Heart },
  ];

  return (
    <div className="container-x py-8">
      <Hero stats={{ owned: owned.length, attention, explored: exploredCount, wishlist: wishCount }} />

      <div className="sticky top-[5.5rem] z-20 -mx-2 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] px-2 py-2 sm:static sm:mx-0 sm:px-0">
        <nav className="glass flex gap-1 rounded-full p-1.5 shadow-[var(--shadow-card)] ring-1 ring-saudi/10" aria-label={t.space.title}>
          {tabs.map(({ id, label, count, icon: I }) => (
            <Link key={id} href={`/my-green-space?tab=${id}`} aria-current={tab === id ? "page" : undefined} scroll={false}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition duration-300 sm:px-4 ${tab === id ? "bg-saudi text-white shadow-[var(--shadow-glow)]" : "text-deep hover:bg-soft"}`}>
              <I className="size-4" /><span className="hidden min-[400px]:inline">{label}</span>
              <span className={`grid min-w-5 place-items-center rounded-full px-1 text-[11px] ${tab === id ? "bg-white/20" : "bg-soft"}`}>{count}</span>
            </Link>
          ))}
        </nav>
        {tab === "plants" && <Link href="/my-green-space/add" className="btn-primary px-5 py-2.5"><Plus className="size-4" />{t.space.addPlant}</Link>}
        {tab === "explored" && explored.length > 0 && <ClearExploredButton />}
      </div>

      <section className="relative mt-6">
        <Sprig className="pointer-events-none absolute -end-10 -top-10 hidden h-56 w-36 text-sage/40 xl:block" />
        {tab === "plants" && (owned.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map((p, i) => <Reveal key={p.id} delay={(i % 3) * 90}><OwnedPlantCard p={p} index={i} /></Reveal>)}
            <Reveal delay={90}>
              <Link href="/my-green-space/add" className="group flex h-full min-h-80 flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-saudi/20 bg-mist/60 p-8 text-center transition hover:border-saudi/50 hover:bg-soft">
                <span className="grid size-14 place-items-center rounded-full bg-white text-saudi shadow-sm transition duration-500 group-hover:rotate-90 group-hover:bg-saudi group-hover:text-white"><Plus className="size-6" /></span>
                <span className="font-bold text-forest">{t.space.addPlant}</span>
                <span className="text-xs text-muted">{ar ? "ازرع نبتة جديدة في حديقتك الرقمية" : "Plant a new one in your digital garden"}</span>
              </Link>
            </Reveal>
          </div>
        ) : (
          <Empty title={t.space.emptyPlants} body={t.space.emptyPlantsBody}
            cta={<><Link href="/my-green-space/add" className="btn-primary px-6 py-3"><Sprout className="size-4" />{t.space.addPlant}</Link><Link href="/shop" className="btn-outline px-6 py-3">{t.hero.ctaShop}</Link></>} />
        ))}
        {tab === "explored" && (explored.length ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{explored.map((p, i) => <Reveal key={p.id} delay={(i % 4) * 70}><ExploredPlantCard p={p} /></Reveal>)}</div>
        ) : (
          <Empty title={t.space.emptyExplored} body={t.space.emptyExploredBody} cta={<Link href="/nada-ai" className="btn-primary px-6 py-3"><Sparkles className="size-4" />{t.nav.nada}</Link>} />
        ))}
        {tab === "wishlist" && (wish.length ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{wish.map((p, i) => <Reveal key={p.id} delay={(i % 4) * 70}><WishlistCard p={p} /></Reveal>)}</div>
        ) : (
          <Empty title={t.space.emptyWishlist} body={t.cart.emptyBody} cta={<Link href="/shop" className="btn-primary px-6 py-3">{t.hero.ctaShop}</Link>} />
        ))}
      </section>
    </div>
  );
}
