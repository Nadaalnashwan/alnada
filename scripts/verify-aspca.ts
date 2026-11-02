/**
 * Cross-checks every species against the ASPCA toxic / non-toxic plant lists for cats and dogs.
 * Output: data/generated/toxicity.json
 *
 * Rules:
 *  - A species is "toxic"/"non_toxic" for an animal only when one of its scientific names
 *    appears verbatim in that ASPCA section.
 *  - Anything not found stays "unknown" (shown as "غير مؤكد"), which the store never treats as safe.
 *
 * Usage: npx tsx scripts/verify-aspca.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { SPECIES_SOURCE } from "../data/species.source";
import type { ToxicityStatus } from "../lib/plants/types";

const LISTS = {
  cats: "https://www.aspca.org/pet-care/animal-poison-control/cats-plant-list",
  dogs: "https://www.aspca.org/pet-care/animal-poison-control/dogs-plant-list",
} as const;

type Animal = keyof typeof LISTS;

function normalise(name: string) {
  return name.toLowerCase().replace(/\s+(spp?\.?|species)$/g, "").replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function sectionNames(html: string, heading: RegExp, nextHeading: RegExp | null) {
  const start = html.search(heading);
  if (start < 0) throw new Error(`Heading not found: ${heading}`);
  const rest = html.slice(start);
  const end = nextHeading ? rest.search(nextHeading) : -1;
  const section = end > 0 ? rest.slice(0, end) : rest;
  const names = new Set<string>();
  for (const m of section.matchAll(/Scientific Names?:<\/b>\s*<i>([^<]+)<\/i>/g)) {
    for (const part of m[1].split(/,|;/)) names.add(normalise(part));
  }
  return names;
}

async function load(animal: Animal) {
  const res = await fetch(LISTS[animal], { headers: { "User-Agent": "Mozilla/5.0 (AL NADA plant catalog verification)" } });
  if (!res.ok) throw new Error(`ASPCA ${animal} list HTTP ${res.status}`);
  const html = await res.text();
  const label = animal === "cats" ? "Cats" : "Dogs";
  return {
    toxic: sectionNames(html, new RegExp(`<h2>Plants Toxic to ${label}</h2>`), new RegExp(`<h2>Plants Non-Toxic to ${label}</h2>`)),
    nonToxic: sectionNames(html, new RegExp(`<h2>Plants Non-Toxic to ${label}</h2>`), null),
  };
}

async function main() {
  const lists = { cats: await load("cats"), dogs: await load("dogs") };
  console.log(`ASPCA entries — cats: ${lists.cats.toxic.size} toxic / ${lists.cats.nonToxic.size} non-toxic; dogs: ${lists.dogs.toxic.size} / ${lists.dogs.nonToxic.size}`);
  const today = new Date().toISOString().slice(0, 10);
  const out: Record<string, unknown> = {};

  for (const sp of SPECIES_SOURCE) {
    const result: Record<Animal, ToxicityStatus> = { cats: "unknown", dogs: "unknown" };
    let matched: string | null = null;
    for (const animal of ["cats", "dogs"] as Animal[]) {
      for (const name of sp.aspca_names.map(normalise)) {
        const inToxic = lists[animal].toxic.has(name);
        const inSafe = lists[animal].nonToxic.has(name);
        // Conflicting listings stay unknown rather than guessing.
        if (inToxic && !inSafe) result[animal] = "toxic";
        else if (inSafe && !inToxic) result[animal] = "non_toxic";
        else continue;
        matched ??= name;
        break;
      }
    }
    out[sp.slug] = {
      cats: result.cats,
      dogs: result.dogs,
      source: matched ? "ASPCA Toxic and Non-Toxic Plant List" : null,
      source_url: matched ? LISTS.cats.replace("cats-plant-list", "toxic-and-non-toxic-plants") : null,
      matched_name: matched,
      match_level: matched ? (matched.includes(" ") ? "species" : "genus") : null,
      verified_at: matched ? today : null,
    };
    console.log(`${sp.scientific_name.padEnd(28)} cats=${result.cats.padEnd(9)} dogs=${result.dogs.padEnd(9)} ${matched ?? "(no ASPCA match)"}`);
  }

  mkdirSync("data/generated", { recursive: true });
  writeFileSync("data/generated/toxicity.json", JSON.stringify(out, null, 2) + "\n");
  console.log("Wrote data/generated/toxicity.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
