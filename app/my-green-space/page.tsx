import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Sprout } from "lucide-react";
import { DewDrop } from "@/components/brand/Logo";
import { ClearExploredButton, ExploredPlantCard, OwnedPlantCard, WishlistCard, type ExploredCard, type OwnedCard, type WishCard } from "@/components/my-green-space/PlantCards";
import { getAllProducts, getAllSpecies } from "@/lib/catalog/repo";
import { loadOwnedPlants } from "@/lib/green-space/data";
import { getDict } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "مساحتي الخضراء | My Green Space" };
export const dynamic = "force-dynamic";

type Tab = "plants" | "explored" | "wishlist";

function Empty({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-saudi/30 bg-soft/50 px-6 py-16 text-center">
      <DewDrop className="mx-auto h-12 w-9 animate-dew" />
      <h2 className="mt-4 text-xl font-bold text-deep">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted">{body}</p>
      {cta && <div className="mt-6 flex justify-center gap-2">{cta}</div>}
    </div>
  );
}

export default async function GreenSpacePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { t, locale } = await getDict();
  const requested = (await searchParams).tab;
  const tab: Tab = (["plants", "explored", "wishlist"] as const).find((x) => x === requested) ?? "plants";
  const ar = locale === "ar";

  const header = (
    <header className="relative mb-8 overflow-hidden rounded-[2rem] bg-deep p-8 text-white sm:p-10">
      <p className="text-sm text-soft">{t.space.subtitle}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t.space.title}</h1>
      <DewDrop tone="dark" className="absolute -bottom-6 end-8 h-36 w-28 opacity-10" />
    </header>
  );
  if (!isSupabaseConfigured()) return <div className="container-x py-10">{header}<p className="card p-6 text-sm leading-7 text-warn">{t.auth.notConfigured}</p></div>;
  const user = await getUser();
  if (!user) return (
    <div className="container-x py-10">{header}
      <Empty title={t.auth.required} body={t.auth.why} cta={<><Link href="/account/login?next=/my-green-space" className="btn-primary">{t.auth.signIn}</Link><Link href="/account/signup" className="btn-outline">{t.auth.signUp}</Link></>} />
    </div>
  );
  const supabase = (await getSupabase())!;
  const [products, species] = await Promise.all([getAllProducts(), getAllSpecies()]);

  let owned: OwnedCard[] = [];
  let explored: ExploredCard[] = [];
  let wish: WishCard[] = [];
  if (tab === "plants") {
    owned = (await loadOwnedPlants(supabase)).map((p) => {
      const sName = p.species ? (ar ? p.species.name_ar : p.species.name_en) : p.unconfirmed_label ?? "?";
      return {
        id: p.id, title: p.nickname ? `${sName} — ${p.nickname}` : sName, nickname: p.nickname, speciesName: sName, scientific: p.species?.scientific_name ?? null,
        image: p.photo_url ?? p.species?.image?.url ?? null, ownPhoto: Boolean(p.photo_url), location: p.location,
        light: p.light_condition ? t.attr.light[p.light_condition as keyof typeof t.attr.light] : null, lastWatered: p.last_watered_at,
        lastActivity: p.last_activity ? t.plant.activity[p.last_activity.activity as keyof typeof t.plant.activity] : null,
        addedAt: p.created_at, source: p.source, unconfirmed: p.identification_status === "unconfirmed",
      };
    });
  } else if (tab === "explored") {
    const { data } = await supabase.from("explored_plants").select("id, reason, last_explored_at, product_id, species:plant_species(slug)").order("last_explored_at", { ascending: false });
    explored = (data ?? []).flatMap((r) => {
      const s = species.find((x) => x.slug === (r.species as unknown as { slug: string } | null)?.slug);
      if (!s) return [];
      const prod = products.find((p) => (r.product_id ? p.id === r.product_id : p.species_slug === s.slug && p.kind === "plant"));
      return [{ id: r.id, speciesSlug: s.slug, name: ar ? s.name_ar : s.name_en, scientific: s.scientific_name, image: s.image?.thumb_url ?? null, reason: r.reason, at: r.last_explored_at, productId: prod?.id ?? null, productSlug: prod?.slug ?? null }];
    });
  } else {
    const { data } = await supabase.from("wishlists").select("product_id").order("created_at", { ascending: false });
    wish = (data ?? []).flatMap((r) => {
      const p = products.find((x) => x.id === r.product_id);
      return p ? [{ id: p.id, slug: p.slug, name: ar ? p.name_ar : p.name_en, scientific: p.species?.scientific_name ?? (ar ? p.variant_ar : p.variant_en), image: p.image?.thumb_url ?? null, price: p.price_sar, stock: p.stock }] : [];
    });
  }

  const tabs: { id: Tab; label: string }[] = [{ id: "plants", label: t.space.myPlants }, { id: "explored", label: t.space.explored }, { id: "wishlist", label: t.space.wishlist }];
  return (
    <div className="container-x py-10">
      {header}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-full bg-soft p-1" aria-label={t.space.title}>
          {tabs.map((x) => <Link key={x.id} href={`/my-green-space?tab=${x.id}`} aria-current={tab === x.id ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === x.id ? "bg-white text-saudi shadow-sm" : "text-deep hover:text-saudi"}`}>{x.label}</Link>)}
        </nav>
        {tab === "plants" && <Link href="/my-green-space/add" className="btn-primary"><Plus className="size-4" />{t.space.addPlant}</Link>}
        {tab === "explored" && explored.length > 0 && <ClearExploredButton />}
      </div>

      {tab === "plants" && (owned.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{owned.map((p) => <OwnedPlantCard key={p.id} p={p} />)}</div>
        : <Empty title={t.space.emptyPlants} body={t.space.emptyPlantsBody} cta={<><Link href="/my-green-space/add" className="btn-primary"><Sprout className="size-4" />{t.space.addPlant}</Link><Link href="/shop" className="btn-outline">{t.hero.ctaShop}</Link></>} />)}
      {tab === "explored" && (explored.length ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{explored.map((p) => <ExploredPlantCard key={p.id} p={p} />)}</div>
        : <Empty title={t.space.emptyExplored} body={t.space.emptyExploredBody} cta={<Link href="/nada-ai" className="btn-primary">{t.nav.nada}</Link>} />)}
      {tab === "wishlist" && (wish.length ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{wish.map((p) => <WishlistCard key={p.id} p={p} />)}</div>
        : <Empty title={t.space.emptyWishlist} body={t.cart.emptyBody} cta={<Link href="/shop" className="btn-primary">{t.hero.ctaShop}</Link>} />)}
    </div>
  );
}
