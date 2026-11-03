import { describe, expect, it } from "vitest";
import { ADVICE_NOTES, SOIL_CHECK_NOTE, isChecklistNote } from "@/lib/green-space/care-notes";
import { careCount, careTasks, companionLines, loggedToday, taskProgress } from "@/lib/green-space/care-tasks";
import { plantInsights } from "@/lib/green-space/insights";
import { LOCAL_SPECIES } from "@/lib/catalog/local";

const now = new Date("2026-11-03T09:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const base = { waterIntervalDays: 7, succulent: false, addedAt: daysAgo(10) };
const task = (tasks: ReturnType<typeof careTasks>, a: string) => tasks.find((t) => t.activity === a)!;

describe("recurring care tasks", () => {
  it("watering is due until a first watering is recorded; others start from the day the plant was added", () => {
    const t = careTasks({ ...base, logs: [] }, now);
    expect(task(t, "watering")).toMatchObject({ state: "due", dueInDays: 0, lastDone: null });
    expect(task(t, "cleaning")).toMatchObject({ state: "upcoming", dueInDays: 4 });
    expect(task(t, "fertilizing")).toMatchObject({ state: "upcoming", dueInDays: 20 });
    expect(task(t, "repotting")).toMatchObject({ state: "upcoming", dueInDays: 355 });
  });

  it("each task follows its own interval — nothing resets daily", () => {
    const logs = [
      { activity: "watering", occurred_at: daysAgo(3) },
      { activity: "cleaning", occurred_at: daysAgo(15) },
      { activity: "fertilizing", occurred_at: daysAgo(1) },
    ];
    const t = careTasks({ ...base, logs }, now);
    expect(task(t, "watering")).toMatchObject({ state: "done", daysSinceLast: 3, dueInDays: 4 });
    expect(task(t, "cleaning")).toMatchObject({ state: "due", daysSinceLast: 15 });
    expect(task(t, "fertilizing")).toMatchObject({ state: "done", dueInDays: 29 });
    expect(taskProgress(t)).toEqual({ done: 2, total: 3, due: 1 });
  });

  it("uses the species water interval and a longer feeding interval for succulents", () => {
    const t = careTasks({ ...base, waterIntervalDays: 14, succulent: true, logs: [{ activity: "watering", occurred_at: daysAgo(10) }] }, now);
    expect(task(t, "watering")).toMatchObject({ state: "done", dueInDays: 4, general: false });
    expect(task(t, "fertilizing").intervalDays).toBe(60);
  });

  it("a recorded soil check ('still moist') completes the watering task until the next check", () => {
    const logs = [{ activity: "watering", occurred_at: daysAgo(9) }, { activity: "observation", occurred_at: daysAgo(0), notes: SOIL_CHECK_NOTE.ar }];
    expect(task(careTasks({ ...base, logs }, now), "watering")).toMatchObject({ state: "done", daysSinceLast: 0, dueInDays: 7, lastVia: "soil_check" });
    // …but the companion line still reports the last real watering, not the soil check.
    expect(companionLines("لولو", careTasks({ ...base, logs }, now), logs, base.addedAt, "ar", now)[0]).toBe("آخر ري مسجل لـلولو كان قبل 9 أيام.");
  });

  it("detects an action already logged today (double-click guard)", () => {
    expect(loggedToday([{ activity: "watering", occurred_at: now.toISOString() }], "watering", now)).toBe(true);
    expect(loggedToday([{ activity: "watering", occurred_at: daysAgo(1) }], "watering", now)).toBe(false);
  });
});

describe("insights stay consistent with the checklist", () => {
  const pothos = LOCAL_SPECIES.find((s) => s.slug === "epipremnum-aureum")!; // moderate water → 7 days
  it("a soil check clears 'soil check due' but does not count as a watering", () => {
    const logs = [{ activity: "watering", occurred_at: daysAgo(9), notes: null }, { activity: "observation", occurred_at: daysAgo(0), notes: SOIL_CHECK_NOTE.en }];
    const i = plantInsights(pothos, { light_condition: "medium" }, logs, now);
    expect(i.soil_check_due).toBe(false);
    expect(i.days_since_watering).toBe(9);
  });
  it("checklist confirmations are never treated as health observations", () => {
    const logs = [{ activity: "observation", occurred_at: daysAgo(0), notes: ADVICE_NOTES.ac.ar }, { activity: "observation", occurred_at: daysAgo(1), notes: "أوراق صفراء" }];
    expect(isChecklistNote(logs[0])).toBe(true);
    expect(plantInsights(pothos, { light_condition: "medium" }, logs, now).recent_observations.map((o) => o.note)).toEqual(["أوراق صفراء"]);
  });
});

describe("companion messages are backed by records", () => {
  it("states days since watering, due tasks and number of care records", () => {
    const logs = [{ activity: "watering", occurred_at: daysAgo(5) }, { activity: "cleaning", occurred_at: daysAgo(20) }, { activity: "pruning", occurred_at: daysAgo(2) }];
    const lines = companionLines("فُلّة", careTasks({ ...base, logs }, now), logs, base.addedAt, "ar", now);
    expect(lines).toContain("آخر ري مسجل لـفُلّة كان قبل 5 أيام.");
    expect(lines).toContain("عندك مهمة عناية وحدة تنتظر فُلّة اليوم.");
    expect(lines).toContain("سجلت 3 عمليات عناية لهالنبتة.");
  });
  it("counts in Arabic correctly", () => {
    expect([1, 2, 3, 11].map((n) => careCount(n, "ar"))).toEqual(["عملية عناية وحدة", "عمليتين عناية", "3 عمليات عناية", "11 عملية عناية"]);
  });
});
