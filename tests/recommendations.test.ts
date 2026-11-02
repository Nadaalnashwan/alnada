import { describe, expect, it } from "vitest";
import { LOCAL_PRODUCTS } from "@/lib/catalog/local";
import { recommend } from "@/lib/recommendations/engine";
import type { ProductWithSpecies } from "@/lib/plants/types";

const names = (r: ReturnType<typeof recommend>) => r.results.map((x) => x.product.species!.slug);

describe("recommendation engine", () => {
  it("Test 1: low-light room with a cat returns only ASPCA-verified cat-safe, low-light plants", () => {
    const r = recommend(LOCAL_PRODUCTS, { placement: "indoor", light: "low", pets: ["cat"] });
    expect(r.results.length).toBeGreaterThan(0);
    for (const x of r.results) {
      expect(x.product.species!.toxicity.cats).toBe("non_toxic");
      expect(x.product.species!.light).toContain("low");
      expect(x.product.image?.url).toMatch(/^https:\/\//);
    }
    // known cat-toxic low-light plants are excluded
    expect(names(r)).not.toContain("epipremnum-aureum");
    expect(names(r)).not.toContain("dracaena-trifasciata");
    expect(r.excluded.pets).toBeGreaterThan(0);
  });

  it("never treats unknown toxicity as safe", () => {
    const r = recommend(LOCAL_PRODUCTS, { pets: ["cat", "dog"] }, { limit: 100 });
    for (const x of r.results) {
      expect(x.product.species!.toxicity.cats).toBe("non_toxic");
      expect(x.product.species!.toxicity.dogs).toBe("non_toxic");
    }
    expect(names(r)).not.toContain("zamioculcas-zamiifolia"); // ASPCA has no listing → unknown
  });

  it("Test 2: Riyadh balcony with afternoon sun requires heat-tolerant outdoor plants", () => {
    const r = recommend(LOCAL_PRODUCTS, { placement: "balcony", city: "الرياض", afternoon_sun: true, light: "full_sun" });
    expect(r.results).toHaveLength(3);
    for (const x of r.results) {
      expect(x.product.species!.heat_tolerant).toBe(true);
      expect(x.product.species!.placement).toContain("outdoor");
      expect(x.reasons_ar.join(" ")).toContain("حرارة");
    }
  });

  it("filters by budget", () => {
    const r = recommend(LOCAL_PRODUCTS, { placement: "indoor", budget_max_sar: 50 }, { limit: 100 });
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results.every((x) => x.product.price_sar <= 50)).toBe(true);
    expect(r.excluded.budget).toBeGreaterThan(0);
  });

  it("'cheaper options' keeps conditions and sorts by price", () => {
    const base = { placement: "indoor" as const, light: "low" as const };
    const first = recommend(LOCAL_PRODUCTS, base);
    const cheapestFirst = Math.min(...first.results.map((x) => x.product.price_sar));
    const cheaper = recommend(LOCAL_PRODUCTS, { ...base, budget_max_sar: cheapestFirst - 1 }, { sort: "price_asc" });
    for (const x of cheaper.results) {
      expect(x.product.price_sar).toBeLessThan(cheapestFirst);
      expect(x.product.species!.light).toContain("low");
    }
  });

  it("checks lighting compatibility", () => {
    const r = recommend(LOCAL_PRODUCTS, { light: "full_sun" }, { limit: 100 });
    expect(r.results.every((x) => x.product.species!.light.includes("full_sun"))).toBe(true);
    expect(names(r)).not.toContain("goeppertia-orbifolia");
  });

  it("prefers drought-tolerant easy plants for low maintenance / frequent travel", () => {
    const r = recommend(LOCAL_PRODUCTS, { placement: "indoor", travels_often: true });
    for (const x of r.results) {
      expect(x.product.species!.water).toBe("low");
      expect(x.product.species!.difficulty).toBe("easy");
    }
  });

  it("returns one product per species", () => {
    const r = recommend(LOCAL_PRODUCTS, {}, { limit: 100 });
    const slugs = names(r);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("returns no results (with exclusion stats) when nothing satisfies hard constraints", () => {
    const r = recommend(LOCAL_PRODUCTS, { placement: "outdoor", light: "low", pets: ["cat", "dog"], budget_max_sar: 10 });
    expect(r.results).toEqual([]);
    expect(Object.values(r.excluded).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it("excludes out-of-stock products", () => {
    const products: ProductWithSpecies[] = LOCAL_PRODUCTS.map((p) => (p.species?.slug === "chlorophytum-comosum" ? { ...p, stock: 0 } : p));
    const r = recommend(products, { pets: ["cat"] }, { limit: 100 });
    expect(names(r)).not.toContain("chlorophytum-comosum");
  });
});
