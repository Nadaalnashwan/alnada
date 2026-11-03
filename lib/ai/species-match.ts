// Strict species matching. A plant name either resolves to exactly one catalogue species or to
// nothing/ambiguity — it must never silently become a different plant (e.g. "صبار" is any cactus,
// not Aloe vera; "فيكس ليراتا" is not the rubber plant).

import type { Species } from "@/lib/plants/types";

/** Normalises Arabic/English text for matching: no diacritics, unified alef/ya/ta marbuta, no leading "ال". */
export const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[ً-ٰٟ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/^ال/, "").trim();

/** Word-level form: every word normalised and stripped of its article, punctuation removed. */
export const words = (s: string) =>
  norm(s).replace(/[()[\]{}،,.:;!?؟«»"'*_\-–—/]+/g, " ").split(/\s+/).filter(Boolean).map((w) => (w.length > 3 ? w.replace(/^ال/, "") : w));
const phrase = (s: string) => words(s).join(" ");
const containsWords = (hay: string, needle: string) => needle.length > 0 && ` ${hay} `.includes(` ${needle} `);

// Unambiguous everyday names that differ from catalogue names. Generic words that cover several
// species ("صبار" = any cactus, "فيكس", "كالاثيا") are deliberately absent: they need clarification.
const ALIASES: Record<string, string> = {
  "سانسفيريا": "dracaena-trifasciata", "سنسيفيريا": "dracaena-trifasciata", "جلد النمر": "dracaena-trifasciata", "snake plant": "dracaena-trifasciata",
  "بوتس": "epipremnum-aureum", "بوثوس": "epipremnum-aureum", "pothos": "epipremnum-aureum",
  "زاميا": "zamioculcas-zamiifolia", "zz": "zamioculcas-zamiifolia", "zz plant": "zamioculcas-zamiifolia",
  "الوفيرا": "aloe-vera", "صبار الالوفيرا": "aloe-vera", "aloe": "aloe-vera",
  "فل": "jasminum-sambac", "ياسمين": "jasminum-sambac", "jasmine": "jasminum-sambac",
  "نعناع": "mentha-spicata", "mint": "mentha-spicata", "ريحان": "ocimum-basilicum", "basil": "ocimum-basilicum",
  "جهنميه": "bougainvillea-glabra", "مجنونه": "bougainvillea-glabra", "دفله": "nerium-oleander",
  "مطاطي": "ficus-elastica", "فيكس مطاطي": "ficus-elastica", "rubber plant": "ficus-elastica",
  "اوركيد": "phalaenopsis-hybrid", "orchid": "phalaenopsis-hybrid",
  "زنبق السلام": "spathiphyllum-wallisii", "سباثيفيلوم": "spathiphyllum-wallisii", "peace lily": "spathiphyllum-wallisii",
  "monstera": "monstera-deliciosa", "مونستيرا": "monstera-deliciosa", "مونستيره": "monstera-deliciosa",
  "عصفور الجنه": "strelitzia-reginae", "لافندر": "lavandula-angustifolia", "خزامي": "lavandula-angustifolia", "اكليل الجبل": "salvia-rosmarinus", "روزماري": "salvia-rosmarinus",
};

/** Every name a species is known by, in word-normalised form (full names and their bracketed parts). */
function namesOf(s: Species): string[] {
  const out = new Set<string>();
  for (const raw of [s.name_ar, s.name_en, s.scientific_name, s.slug.replace(/-/g, " ")]) {
    out.add(phrase(raw));
    const inner = raw.match(/\(([^)]+)\)/);
    if (inner) { out.add(phrase(inner[1])); out.add(phrase(raw.replace(/\([^)]*\)/, ""))); }
  }
  out.delete("");
  return [...out];
}

export interface SpeciesMatch { match: Species | null; candidates: Species[] }

export function matchSpecies(mention: string, species: Species[]): SpeciesMatch {
  const m = phrase(mention).replace(/^(نبته|نبات|شجره|زهره|plant|the) /, "");
  if (!m) return { match: null, candidates: [] };
  const uniq = (list: Species[]) => [...new Map(list.map((s) => [s.slug, s])).values()];
  const decide = (list: Species[]): SpeciesMatch | null => {
    const u = uniq(list);
    if (u.length === 1) return { match: u[0], candidates: u };
    if (u.length > 1) return { match: null, candidates: u };
    return null;
  };
  const bySlug = (slug: string) => species.find((s) => s.slug === slug);
  const aliasHits = (pred: (alias: string) => boolean) =>
    Object.entries(ALIASES).filter(([a]) => pred(phrase(a))).map(([, slug]) => bySlug(slug)).filter((s): s is Species => !!s);

  // 1) exact name, 2) exact alias
  const exact = decide([...species.filter((s) => namesOf(s).includes(m)), ...aliasHits((a) => a === m)]);
  if (exact) return exact;
  // 3) the mention is a whole-word part of a catalogue name ("صبار البرميل" ⊂ "صبار البرميل الذهبي")
  if (m.length >= 3) {
    const partial = decide(species.filter((s) => namesOf(s).some((n) => containsWords(n, m))));
    if (partial) return partial;
  }
  // 4) the mention contains a full name or alias ("مونستيرا كبيرة") — the longest such name wins
  const contained: { s: Species; len: number }[] = [];
  for (const s of species) for (const n of namesOf(s)) if (n.length >= 4 && containsWords(m, n)) contained.push({ s, len: n.length });
  for (const [a, slug] of Object.entries(ALIASES)) {
    const p = phrase(a);
    const s = bySlug(slug);
    if (s && p.length >= 2 && containsWords(m, p)) contained.push({ s, len: p.length });
  }
  if (contained.length) {
    const top = Math.max(...contained.map((c) => c.len));
    const best = decide(contained.filter((c) => c.len === top).map((c) => c.s));
    if (best) return best;
  }
  return { match: null, candidates: [] };
}

/** The single species a name refers to, or null when it is unknown or ambiguous. */
export function resolveSpecies(mention: string, species: Species[]): Species | null {
  return matchSpecies(mention, species).match;
}
