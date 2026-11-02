# CLAUDE.md — AL NADA | الندى

Guidance for AI coding assistants (Claude, ChatGPT, etc.) working in this repository.

## Project identity
AL NADA (الندى, "dew") is an Arabic-first AI plant store for Saudi Arabia with a personal plant
collection ("My Green Space") and an assistant, **Nada AI**. Tagline: حياة خضراء تبدأ بقطرة —
"A Greener Life Begins with a Drop". Meta AI Bootcamp Project 4.

## Non-negotiables
- **Meta Llama is the runtime AI model.** Do not switch Nada AI to Gemini, GPT or Claude.
  Provider is configurable (`LLAMA_PROVIDER=cloudflare|groq`); verify model ids with `npm run verify:llama`.
- Never fabricate: species, care facts, pet safety, AI replies, test results, deploy/push status.
- Pet safety: only ASPCA-listed `non_toxic` counts as safe. `unknown` → "غير مؤكد", never safe.
- The model never touches the database. It returns JSON (`UnderstandingSchema`), validated by Zod,
  mapped to explicit server functions in `lib/ai/nada.ts`. Confirm actions only after DB success.
- Secrets live only in `.env.local` / Vercel env. Never commit them. No service-role key in the app.

## Brand & design system ("Living Botanical")
Brand colours (exact): Saudi Green `#006C35` (primary), Deep Green `#004D26`, Soft Green `#EAF5EE`, White `#FFFFFF`
(dominant background). Supporting tokens in `app/globals.css`: `forest` (dark bands/footer), `leaf`/`sprout`
(fresh accents), `sage`, `mist` (light section bg), `dew`, `cream` (warm surface — sparingly, never dominant),
`sun` (tiny accent only). No burgundy, maroon, purple, beige-dominant themes, heavy gradients or cartoon plants.
Font: IBM Plex Sans Arabic. RTL-first; English via `locale` cookie; use logical props (`ms/me/start/end`).
Official logo: `public/brand/alnada-mark*.png` — the exact supplied artwork (only margins trimmed); never
recolour or redraw it; on dark surfaces it sits on an ivory badge (`DewDrop tone="dark"`). Favicon/app icons:
`app/icon.png`, `app/apple-icon.png`, `app/manifest.ts`, `public/brand/alnada-app-icon-*.png`.
My Green Space = one shared garden shelf (`components/my-green-space/Garden.tsx`, `PottedPlant.tsx`): every owned
plant in its own pot side by side; selecting one shows its full details below (no page reload).
The same component is the homepage hero (`<Garden variant="hero" intro=…>`): the signed-in customer's own plants
(mapped by `lib/green-space/garden.ts` `buildGarden`, shared with /my-green-space), or for visitors/empty gardens a
read-only `sampleGarden` from public catalogue data, labelled "نبتة نموذجية" — never another customer's plants.
Shared pieces: `components/brand/Logo.tsx` (official mark + wordmark), `components/brand/Decor.tsx` (Leaf, Sprig,
Blob, DewCluster, Pot — decorative, aria-hidden), `components/ui/Reveal.tsx` (scroll reveal; content visible
without JS), `components/ui/SectionHeading.tsx`, `components/my-green-space/PlantBox.tsx` (plant "planted" in a pot).
Utilities: `btn-*`, `card`, `chip`, `eyebrow`, `display`, `section-title`, `lead`, `arch`, `glass`, `bg-botanical`,
`bg-forest-glow`. Motion: `animate-rise|float|sway|dew|pop|shimmer|marquee` — subtle; all disabled by
`prefers-reduced-motion`.
Catalogue photos are mirrored to `public/images/catalog` (`npm run data:mirror`) — never hot-link Wikimedia
(it rate-limits); licence/attribution stays in `data/generated/images.json` and on product pages.

## Stack
Next.js 15 App Router · TypeScript · Tailwind v4 · Lucide · Zod · Supabase (Postgres, Auth, Storage, RLS)
· Meta Llama via Cloudflare Workers AI (OpenAI-compatible endpoint) · Perenual (import only) · Vercel.

## Layout
```
app/                    routes (store, nada-ai, my-green-space, account, orders, admin, api/*)
components/{store,chat,my-green-space,admin,cart,auth,layout,brand}
lib/ai/                 llama.ts (client), provider.ts (config), nada.ts (pipeline), schemas.ts, prompts.ts, supabase-data.ts
lib/catalog/            repo.ts (Supabase or local fallback), filter.ts, card.ts, local.ts
lib/recommendations/    engine.ts (deterministic hard constraints + weighted scoring)
lib/plants/             types.ts, categories.ts (rule-based category membership)
lib/supabase/           server/client/config helpers   lib/i18n/  dict.ts (ar/en), format.ts
data/                   species.source.ts, products.source.ts (curated), generated/*.json (script output)
scripts/                verify-aspca, fetch-images, import-perenual, build-catalog, verify-llama
supabase/migrations/    schema + RLS + functions    supabase/seed/seed.sql (generated)
tests/                  vitest: recommendations, Nada pipeline, DB/RLS in PGlite
```

## Data workflow
1. Edit curated sources in `data/*.source.ts`.
2. `npm run data:aspca` (pet toxicity) · `npm run data:images` (Wikimedia photos) · `npm run data:perenual` (needs key).
3. `npm run data:build` → regenerates `data/generated/catalog.json` and `supabase/seed/seed.sql`.
Never hand-edit generated files.

## Database migrations
- New change = new file `supabase/migrations/<timestamp>_<name>.sql`; never edit applied migrations.
- Every new table: RLS enabled + policies; private rows keyed on `(select auth.uid())`.
- Admin writes require `public.is_admin()`; customers cannot update `profiles.role`.
- Run `npm test` — `tests/db/rls.test.ts` executes all migrations + seed in PGlite and checks isolation.
- Apply to Supabase with the Supabase MCP `apply_migration` or `supabase db push`, then run the seed.

## Testing
`npm test` (vitest), `npm run lint`, `npm run typecheck`, `npm run build`. Report only results you ran.

## GitHub workflow
Repo: https://github.com/Nadaalnashwan/alnada (source of truth). Commit + push after each stable
milestone; never force-push; keep `HANDOFF.md` current with status, last pushed commit and next tasks.
