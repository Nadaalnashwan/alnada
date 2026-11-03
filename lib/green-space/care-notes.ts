// Fixed notes for care logs written by My Green Space's checklist (stored as activity "observation").
// They record something the customer confirmed — a soil check or a change they made — and must never be
// read as a plant-health observation.

export const SOIL_CHECK_NOTE = { ar: "فحصت التربة وكانت رطبة — ما احتاجت ري", en: "Checked the soil: still moist, no watering needed" } as const;

export type AdviceKey = "light" | "ac";
export const ADVICE_NOTES: Record<AdviceKey, { ar: string; en: string }> = {
  light: { ar: "نقلتها لمكان إضاءته أنسب", en: "Moved it to a spot with better-suited light" },
  ac: { ar: "أبعدتها عن هواء المكيف المباشر", en: "Moved it away from direct AC airflow" },
};

const matches = (note: string | null | undefined, n: { ar: string; en: string }) => !!note && (note === n.ar || note === n.en);
export const isSoilCheck = (l: { activity: string; notes?: string | null }) => l.activity === "observation" && matches(l.notes, SOIL_CHECK_NOTE);
export const adviceOf = (l: { activity: string; notes?: string | null }): AdviceKey | null =>
  l.activity !== "observation" ? null : (Object.keys(ADVICE_NOTES) as AdviceKey[]).find((k) => matches(l.notes, ADVICE_NOTES[k])) ?? null;
/** Checklist confirmations, not health observations. */
export const isChecklistNote = (l: { activity: string; notes?: string | null }) => isSoilCheck(l) || adviceOf(l) !== null;
