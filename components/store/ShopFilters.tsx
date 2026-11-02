import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { Dict } from "@/lib/i18n/dict";
import type { CatalogFilter } from "@/lib/catalog/filter";

/** Server-rendered GET form: works without JavaScript and keeps filters in the URL (shareable). */
export function ShopFilters({ t, f, action, hideKind }: { t: Dict; f: CatalogFilter; action: string; hideKind?: boolean }) {
  return (
    <form action={action} className="space-y-5 rounded-[1.75rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-saudi/[0.06]" aria-label={t.shop.filters}>
      <p className="flex items-center gap-2 text-sm font-bold text-forest"><SlidersHorizontal className="size-4 text-saudi" />{t.shop.filters}</p>
      {f.q && <input type="hidden" name="q" value={f.q} />}
      {!hideKind && (
        <fieldset>
          <legend className="label">{t.shop.kind}</legend>
          <select name="kind" defaultValue={f.kind ?? ""} className="input">
            <option value="">{t.shop.all}</option>
            <option value="plants">{t.shop.plants}</option>
            <option value="gift">{t.shop.gifts}</option>
            <option value="pot">{t.shop.pots}</option>
            <option value="soil">{t.shop.soil}</option>
            <option value="accessory">{t.shop.accessories}</option>
          </select>
        </fieldset>
      )}
      <fieldset>
        <legend className="label">{t.product.light}</legend>
        <select name="light" defaultValue={f.light ?? ""} className="input">
          <option value="">{t.shop.all}</option>
          {(["low", "medium", "bright_indirect", "full_sun"] as const).map((l) => <option key={l} value={l}>{t.attr.light[l]}</option>)}
        </select>
      </fieldset>
      <fieldset>
        <legend className="label">{t.shop.maxPrice}</legend>
        <input type="number" name="max" min={1} step={1} defaultValue={f.maxPrice ?? ""} className="input" inputMode="numeric" placeholder="SAR" />
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-deep">
        <input type="checkbox" name="pet" value="1" defaultChecked={f.petSafe} className="size-4 accent-saudi" />{t.shop.petSafe}
      </label>
      <fieldset>
        <legend className="label">{t.shop.sort}</legend>
        <select name="sort" defaultValue={f.sort ?? "featured"} className="input">
          <option value="featured">{t.shop.sortFeatured}</option>
          <option value="price_asc">{t.shop.sortPriceAsc}</option>
          <option value="price_desc">{t.shop.sortPriceDesc}</option>
          <option value="name">{t.shop.sortName}</option>
        </select>
      </fieldset>
      <div className="flex gap-2">
        <button className="btn-primary flex-1">{t.shop.apply}</button>
        <Link href={action} className="btn-ghost">{t.shop.clear}</Link>
      </div>
    </form>
  );
}

export function parseFilter(sp: Record<string, string | string[] | undefined>): CatalogFilter {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) || undefined;
  const kinds = ["plants", "plant", "gift", "pot", "soil", "accessory"];
  const lights = ["low", "medium", "bright_indirect", "full_sun"];
  const sorts = ["featured", "price_asc", "price_desc", "name"];
  const max = Number(one("max"));
  return {
    q: one("q")?.slice(0, 80),
    kind: kinds.includes(one("kind") ?? "") ? (one("kind") as CatalogFilter["kind"]) : undefined,
    light: lights.includes(one("light") ?? "") ? (one("light") as CatalogFilter["light"]) : undefined,
    petSafe: one("pet") === "1",
    maxPrice: Number.isFinite(max) && max > 0 ? max : undefined,
    sort: sorts.includes(one("sort") ?? "") ? (one("sort") as CatalogFilter["sort"]) : "featured",
  };
}
