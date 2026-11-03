// Finds the customer's OWN saved plants mentioned in a message — before anything is read as a generic
// species. Nicknames are matched with Arabic spelling variants (ة/ه, ى/ي, أ/إ/آ, shadda/diacritics,
// tatweel) and joined prefixes (و ف ب ل ك + ال: "لفله", "بالفلة", "وفلّة"). Works for any nickname.

import type { Species } from "@/lib/plants/types";

export interface NamedPlant { id: string; nickname: string | null; species_slug: string | null }

/** Letters only, unified spelling, no diacritics/shadda/tatweel, punctuation → spaces. */
export const normalizeArabic = (s: string) =>
  s.toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const tokens = (s: string) => normalizeArabic(s).split(" ").filter(Boolean);
const PREFIXES = ["وبال", "وال", "بال", "فال", "كال", "لل", "ال", "وب", "ول", "و", "ف", "ب", "ل", "ك"];

/** A message word plus the forms it takes without a joined prefix and/or article. */
function forms(word: string): Set<string> {
  const out = new Set([word]);
  for (const p of PREFIXES) if (word.startsWith(p) && word.length - p.length >= 2) out.add(word.slice(p.length));
  for (const f of [...out]) if (f.startsWith("ال") && f.length > 3) out.add(f.slice(2));
  return out;
}
const bare = (w: string) => (w.startsWith("ال") && w.length > 3 ? w.slice(2) : w);

/** Whether the message contains this phrase (word sequence), allowing prefixes on its first word. */
function containsPhrase(msg: string[], phrase: string[]): boolean {
  if (!phrase.length) return false;
  const first = bare(phrase[0]);
  for (let i = 0; i + phrase.length <= msg.length; i++) {
    if (![...forms(msg[i])].some((f) => bare(f) === first)) continue;
    if (phrase.slice(1).every((w, j) => bare(msg[i + 1 + j]) === bare(w))) return true;
  }
  return false;
}

export interface UserPlantMentions<T extends NamedPlant> {
  /** Plants whose nickname appears in the message (strongest signal). */
  byNickname: T[];
  /** Plants whose species name (Arabic/English/scientific) appears in the message. */
  bySpecies: T[];
}

export function findUserPlantMentions<T extends NamedPlant>(message: string, plants: T[], species: Species[]): UserPlantMentions<T> {
  const msg = tokens(message);
  const byNickname = plants.filter((p) => {
    const nick = p.nickname ? tokens(p.nickname) : [];
    return nick.length > 0 && nick.join("").length >= 2 && containsPhrase(msg, nick);
  });
  const bySpecies = plants.filter((p) => {
    const sp = p.species_slug ? species.find((s) => s.slug === p.species_slug) : null;
    if (!sp) return false;
    const names = [sp.name_ar, sp.name_en, sp.scientific_name]
      .flatMap((n) => [n, n.replace(/\([^)]*\)/g, ""), n.match(/\(([^)]+)\)/)?.[1] ?? ""])
      .map(tokens).filter((t) => t.join("").length >= 3);
    return names.some((n) => containsPhrase(msg, n));
  });
  return { byNickname, bySpecies };
}

/** Whether a model-extracted mention is really just one of the customer's nicknames (not a species). */
export const isNicknameOf = (mention: string, plants: NamedPlant[]) =>
  plants.some((p) => p.nickname && containsPhrase(tokens(mention), tokens(p.nickname)) && tokens(mention).length <= tokens(p.nickname).length + 1);

/** "أسقيها / لها / عليها / نبتتي / it / my plant" — a follow-up about the plant already being discussed. */
export const refersToCurrentPlant = (message: string) =>
  /(^|\s)\S*(ها|هي)(\s|$)|نبتتي|(^|\s)(it|its|my plant)(\s|$)/u.test(` ${normalizeArabic(message)} `);
