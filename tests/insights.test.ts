import { describe, expect, it } from "vitest";
import { LOCAL_SPECIES } from "@/lib/catalog/local";
import { plantInsights } from "@/lib/green-space/insights";

const sp = (slug: string) => LOCAL_SPECIES.find((s) => s.slug === slug)!;
const now = new Date("2026-11-02T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe("record-based plant insights", () => {
  it("reports no watering recorded rather than inventing one", () => {
    const i = plantInsights(sp("monstera-deliciosa"), { light_condition: "medium" }, [], now);
    expect(i.no_watering_recorded).toBe(true);
    expect(i.days_since_watering).toBeNull();
    expect(i.soil_check_due).toBe(false);
  });
  it("flags a soil check when the recorded gap exceeds the species' typical interval", () => {
    const moderate = plantInsights(sp("monstera-deliciosa"), { light_condition: "medium" }, [{ activity: "watering", occurred_at: daysAgo(9), notes: null }], now);
    expect(moderate.days_since_watering).toBe(9);
    expect(moderate.soil_check_due).toBe(true);
    const succulent = plantInsights(sp("aloe-vera"), { light_condition: "full_sun" }, [{ activity: "watering", occurred_at: daysAgo(9), notes: null }], now);
    expect(succulent.soil_check_due).toBe(false); // low-water plants: 14-day check interval
  });
  it("detects recorded light that does not match the species", () => {
    expect(plantInsights(sp("aloe-vera"), { light_condition: "low" }, [], now).light_matches).toBe(false);
    expect(plantInsights(sp("dracaena-trifasciata"), { light_condition: "low" }, [], now).light_matches).toBe(true);
  });
  it("surfaces recent observations and need-based products only", () => {
    const i = plantInsights(sp("goeppertia-orbifolia"), { light_condition: "medium" }, [{ activity: "observation", occurred_at: daysAgo(1), notes: "حواف بنية" }], now);
    expect(i.recent_observations).toEqual([{ date: daysAgo(1).slice(0, 10), note: "حواف بنية" }]);
    expect(i.helpful_product_slugs).toContain("ultrasonic-humidifier"); // high-humidity species
    expect(plantInsights(sp("aloe-vera"), { light_condition: "full_sun" }, [], now).helpful_product_slugs).toEqual([]);
  });
});

describe("Arabic day phrasing", () => {
  it("agrees numbers with the noun", async () => {
    const { dayCount } = await import("@/lib/i18n/format");
    expect(dayCount(1, "ar")).toBe("يوم واحد");
    expect(dayCount(2, "ar")).toBe("يومين");
    expect(dayCount(7, "ar")).toBe("7 أيام");
    expect(dayCount(14, "ar")).toBe("14 يومًا");
    expect(dayCount(1, "en")).toBe("1 day");
    expect(dayCount(9, "en")).toBe("9 days");
  });
  it("uses it in record-based suggestions", () => {
    const i = plantInsights(sp("monstera-deliciosa"), { light_condition: "medium" }, [{ activity: "watering", occurred_at: daysAgo(9), notes: null }], now);
    expect(i.suggestions_ar[0]).toContain("9 أيام");
  });
});
