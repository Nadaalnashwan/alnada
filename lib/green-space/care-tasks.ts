// Recurring care tasks for one saved plant, derived ONLY from its species needs and its own care logs.
// A task is "completed" by writing a real care log (POST /api/care-logs), so completion persists in
// Supabase and each task follows its own interval — nothing resets daily. These are in-app suggestions:
// there are no notifications or automatic reminders.

import { dayCount } from "@/lib/i18n/format";
import { isSoilCheck } from "./care-notes";

export type TaskActivity = "watering" | "cleaning" | "fertilizing" | "repotting";
export type TaskState = "due" | "done" | "upcoming";

export interface CareTask {
  activity: TaskActivity;
  /** Days between occurrences for this plant. */
  intervalDays: number;
  state: TaskState;
  /** Last time it was logged (ISO), if ever. */
  lastDone: string | null;
  daysSinceLast: number | null;
  /** Days until it is due again (0 = due now). */
  dueInDays: number;
  /** Whether the interval is general guidance rather than species data. */
  general: boolean;
  /** What completed it last: the activity itself, or (watering only) a recorded soil check. */
  lastVia: "activity" | "soil_check" | null;
}

export interface TaskInput {
  /** Typical soil-check interval from the species water need (insights.ts: low 14 / moderate 7 / high 4). */
  waterIntervalDays: number | null;
  succulent: boolean;
  /** When the plant was added (ISO) — the starting point for tasks that were never logged. */
  addedAt: string;
  logs: { activity: string; occurred_at: string; notes?: string | null }[];
}

const DAY = 86_400_000;
const daysBetween = (fromIso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY));

/** Wipe leaves every 2 weeks; feed monthly (succulents every 2 months); check for repotting yearly. */
export const GENERAL_INTERVALS = { cleaning: 14, fertilizing: 30, fertilizingSucculent: 60, repotting: 365 } as const;

export function careTasks(input: TaskInput, now: Date = new Date()): CareTask[] {
  const plan: { activity: TaskActivity; interval: number; general: boolean; dueWhenNeverDone: boolean }[] = [
    // Watering is the one task that is due until a first watering is recorded.
    { activity: "watering", interval: input.waterIntervalDays ?? 7, general: input.waterIntervalDays === null, dueWhenNeverDone: true },
    { activity: "cleaning", interval: GENERAL_INTERVALS.cleaning, general: true, dueWhenNeverDone: false },
    { activity: "fertilizing", interval: input.succulent ? GENERAL_INTERVALS.fertilizingSucculent : GENERAL_INTERVALS.fertilizing, general: true, dueWhenNeverDone: false },
    { activity: "repotting", interval: GENERAL_INTERVALS.repotting, general: true, dueWhenNeverDone: false },
  ];
  return plan.map(({ activity, interval, general, dueWhenNeverDone }) => {
    // The watering task is "check the soil, water if dry": a recorded soil check completes it too.
    const counts = (l: TaskInput["logs"][number]) => l.activity === activity || (activity === "watering" && isSoilCheck(l));
    const last = input.logs.filter(counts).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0] ?? null;
    if (last) {
      const since = daysBetween(last.occurred_at, now);
      const dueIn = Math.max(0, interval - since);
      return { activity, intervalDays: interval, state: dueIn === 0 ? "due" : "done", lastDone: last.occurred_at, daysSinceLast: since, dueInDays: dueIn, general, lastVia: isSoilCheck(last) ? "soil_check" : "activity" };
    }
    if (dueWhenNeverDone) return { activity, intervalDays: interval, state: "due", lastDone: null, daysSinceLast: null, dueInDays: 0, general, lastVia: null };
    // Never logged: counted from the day the plant joined the garden.
    const dueIn = Math.max(0, interval - daysBetween(input.addedAt, now));
    return { activity, intervalDays: interval, state: dueIn === 0 ? "due" : "upcoming", lastDone: null, daysSinceLast: null, dueInDays: dueIn, general, lastVia: null };
  });
}

/** Progress over the tasks that matter this period: done within their interval vs. due now. */
export function taskProgress(tasks: CareTask[]) {
  const relevant = tasks.filter((t) => t.state !== "upcoming");
  return { done: relevant.filter((t) => t.state === "done").length, total: relevant.length, due: tasks.filter((t) => t.state === "due").length };
}

/** Whether this activity was already logged on the same calendar day (guards against double logging). */
export const loggedToday = (logs: { activity: string; occurred_at: string }[], activity: string, now: Date = new Date()) =>
  logs.some((l) => l.activity === activity && new Date(l.occurred_at).toDateString() === now.toDateString());

/** "عملية واحدة / عمليتين / ٣ عمليات / ١١ عملية" — Arabic counting for care records. */
export function careCount(n: number, locale: "ar" | "en") {
  if (locale === "en") return `${n} care ${n === 1 ? "record" : "records"}`;
  if (n === 1) return "عملية عناية وحدة";
  if (n === 2) return "عمليتين عناية";
  if (n >= 3 && n <= 10) return `${n} عمليات عناية`;
  return `${n} عملية عناية`;
}

/** Short, factual companion lines for the plant — each one is backed by saved records only. */
export function companionLines(name: string, tasks: CareTask[], logs: { activity: string; occurred_at: string }[], addedAt: string, locale: "ar" | "en", now: Date = new Date()): string[] {
  const ar = locale === "ar";
  const lastWater = logs.filter((l) => l.activity === "watering").sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  const waterDays = lastWater ? daysBetween(lastWater.occurred_at, now) : null;
  const logCount = logs.length;
  const due = tasks.filter((t) => t.state === "due").length;
  const lines: string[] = [];
  if (waterDays === 0) lines.push(ar ? `${name} انسقت اليوم 💧` : `${name} was watered today 💧`);
  else if (waterDays !== null) lines.push(ar ? `آخر ري مسجل لـ${name} كان قبل ${dayCount(waterDays, "ar")}.` : `${name} was last watered ${dayCount(waterDays, "en")} ago (your records).`);
  else lines.push(ar ? `ما سجلنا ري لـ${name} للحين.` : `No watering recorded for ${name} yet.`);
  if (due > 0) lines.push(ar ? (due === 1 ? `عندك مهمة عناية وحدة تنتظر ${name} اليوم.` : `عندك ${due === 2 ? "مهمتين" : `${due} مهام`} عناية تنتظر ${name} اليوم.`) : `${due} care ${due === 1 ? "task is" : "tasks are"} waiting for ${name} today.`);
  else lines.push(ar ? `ما على ${name} مهام مستحقة اليوم حسب سجلاتك 🌿` : `Nothing due for ${name} today, based on your records 🌿`);
  if (logCount > 0) lines.push(ar ? `سجلت ${careCount(logCount, "ar")} لهالنبتة.` : `You've logged ${careCount(logCount, "en")} for this plant.`);
  const since = daysBetween(addedAt, now);
  if (since > 0) lines.push(ar ? `معك في حديقتك من ${dayCount(since, "ar")}.` : `In your garden for ${dayCount(since, "en")}.`);
  return lines;
}
