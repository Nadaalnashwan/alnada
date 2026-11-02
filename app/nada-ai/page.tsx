import type { Metadata } from "next";
import { NadaChat, type PlantOption } from "@/components/chat/NadaChat";
import { isLlamaConfigured } from "@/lib/ai/llama";
import { getAllSpecies, getSpeciesBySlug } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ندى AI | Nada AI" };
export const dynamic = "force-dynamic";

export default async function NadaPage({ searchParams }: { searchParams: Promise<{ plant?: string; userPlant?: string }> }) {
  const sp = await searchParams;
  const { locale } = await getDict();
  const [user, supabase, species] = await Promise.all([getUser(), getSupabase(), getAllSpecies()]);

  let plants: PlantOption[] = [];
  if (user && supabase) {
    const { data } = await supabase.from("user_plants").select("id, nickname, unconfirmed_label, species:plant_species(slug)").order("created_at", { ascending: false }).limit(24);
    plants = (data ?? []).map((p) => {
      const slug = (p.species as unknown as { slug: string } | null)?.slug;
      const s = species.find((x) => x.slug === slug);
      const name = s ? (locale === "ar" ? s.name_ar : s.name_en) : p.unconfirmed_label ?? "?";
      return { id: p.id, title: p.nickname ? `${p.nickname}` : name, image: s?.image?.thumb_url ?? null };
    });
  }

  const focus = sp.plant ? await getSpeciesBySlug(sp.plant) : null;
  const initialPrompt = focus ? (locale === "ar" ? `كيف أعتني بنبتة ${focus.name_ar}؟` : `How do I care for a ${focus.name_en}?`) : undefined;
  const initialPlantId = sp.userPlant && plants.some((p) => p.id === sp.userPlant) ? sp.userPlant : undefined;

  return (
    <div className="container-x py-8">
      <NadaChat plants={plants} aiReady={isLlamaConfigured()} initialPrompt={initialPrompt} initialPlantId={initialPlantId} />
    </div>
  );
}
