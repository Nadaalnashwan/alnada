import type { Locale } from "./dict";

export function formatSAR(amount: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount);
}

export function formatDate(iso: string | Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", opts).format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Pick the localised field of a bilingual record. */
export function L<T extends Record<string, unknown>>(rec: T, base: string, locale: Locale): string {
  return (rec[`${base}_${locale}`] as string) ?? (rec[`${base}_ar`] as string) ?? "";
}
