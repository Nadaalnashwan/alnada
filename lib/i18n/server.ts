import "server-only";
import { cookies } from "next/headers";
import { DICTS, type Locale } from "./dict";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get("locale")?.value;
  return v === "en" ? "en" : "ar";
}

export async function getDict() {
  const locale = await getLocale();
  return { locale, t: DICTS[locale], dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const) };
}
