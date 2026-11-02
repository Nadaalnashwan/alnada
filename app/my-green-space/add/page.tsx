import { redirect } from "next/navigation";
import { AddPlantForm } from "@/components/my-green-space/AddPlantForm";
import { getAllSpecies } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AddPlantPage({ searchParams }: { searchParams: Promise<{ species?: string }> }) {
  const { t } = await getDict();
  if (!isSupabaseConfigured()) return <div className="container-x py-14"><p className="card mx-auto max-w-lg p-6 text-sm text-warn">{t.auth.notConfigured}</p></div>;
  if (!(await getUser())) redirect("/account/login?next=/my-green-space/add");
  const species = (await getAllSpecies()).map((s) => ({ slug: s.slug, name_ar: s.name_ar, name_en: s.name_en, scientific: s.scientific_name, image: s.image?.thumb_url ?? null }));
  const initial = (await searchParams).species;
  return (
    <div className="container-x py-10">
      <h1 className="mb-6 text-3xl font-bold text-deep">{t.addPlant.title}</h1>
      <AddPlantForm species={species} initialSlug={species.some((s) => s.slug === initial) ? initial : undefined} />
    </div>
  );
}
