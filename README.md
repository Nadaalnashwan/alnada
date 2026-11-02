# الندى | AL NADA

**حياة خضراء تبدأ بقطرة — A Greener Life Begins with a Drop**

AL NADA is an Arabic-first, AI-powered plant store for Saudi Arabia. Customers discover plants that
fit their space with **Nada AI** (powered by **Meta Llama**), buy them through a demo checkout, and
keep caring for them in **My Green Space** — a personal digital garden with care tracking that the
assistant can read (with permission) to give personalised advice.

> Educational project (Meta AI Bootcamp, Project 4). Prices, stock and orders are **demo data**;
> no real payments are processed.

## Features
- **Storefront** — 76 products (52 plant listings across 50 real species, 4 gifts, 20 pots/soil/tools),
  21 rule-based categories (a plant belongs to many without duplicate records), search, filters, product pages
  with care data, ASPCA pet-safety status and photo licences.
- **Nada AI** — care, rescue and smart-finder workflows in Saudi Arabic or English; product cards with
  real images/prices; add to cart / wishlist from chat; reads your saved plants and care logs; logs care
  ("سقيت لولو اليوم"); remembers conditions across turns ("وريني خيارات أرخص").
- **My Green Space** — owned plants (store purchases or manual, incl. unconfirmed IDs), explored plants
  (separate from owned, clearable), wishlist, per-plant pages with care timeline, logging, photos.
- **Accounts** — Supabase Auth, profile, password reset; account-synced cart; order history.
- **Admin** — protected dashboard: prices, stock, availability, images, demo orders, aggregated analytics.

## Tech
Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Lucide · Zod · Supabase (Postgres, Auth,
Storage, RLS) · Meta Llama via **Cloudflare Workers AI** (Groq optional) · Perenual API (import) · Vercel.

## AI architecture
```
User message
 → Meta Llama: intent + entities as JSON          (lib/ai/prompts.ts UNDERSTAND_SYSTEM)
 → Zod validation (UnderstandingSchema)            invalid → retry once → clarify
 → authorised data retrieval (RLS-scoped client)   saved plants, care logs, explored, wishlist
 → botanical cache + deterministic logic           recommendation engine / care & rescue checklists
 → Meta Llama: reply grounded in FACTS JSON        never claims success unless the DB confirmed it
 → rich UI blocks                                  products, plant cards, checklists, timelines, actions
```
The model can only select from a fixed set of intents mapped to explicit server functions; it never
runs queries. Only minimal data (nicknames, species, locations, care dates) is sent to the model —
no names, emails or order details. If the provider fails, the UI shows an error, never a fake reply.

The **recommendation engine** (`lib/recommendations/engine.ts`) applies hard constraints first
(stock, pet safety, placement, light, Saudi heat exposure, budget) and then weighted scoring
(maintenance, experience, size, flowers, fragrance). Scores are preference fit, not survival odds.

## Local setup
```bash
git clone https://github.com/Nadaalnashwan/alnada.git && cd alnada
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```
Without Supabase env vars the storefront and recommendations run on the curated local catalogue
(identical to the seed); accounts and personal features show a "database not connected" notice.

### Environment
| Variable | Where | Purpose |
|---|---|---|
| `LLAMA_PROVIDER` | server | `cloudflare` (default) or `groq` |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | server | Workers AI (token: Workers AI Read + Edit) |
| `LLAMA_MODEL` | server | Meta Llama model id, verified with `npm run verify:llama` |
| `GROQ_API_KEY` | server | only when `LLAMA_PROVIDER=groq` |
| `PERENUAL_API_KEY` | scripts | botanical import |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser+server | Supabase (RLS enforces access) |

### Supabase setup
1. Create a project named `alnada`.
2. Apply `supabase/migrations/*.sql` in order (SQL editor, `supabase db push`, or the Supabase MCP).
3. Run `supabase/seed/seed.sql`.
4. Auth → URL configuration: add `http://localhost:3000/auth/callback` and your Vercel URL `/auth/callback`.
5. Make an admin: sign up, then run `supabase/admin/grant-admin.sql` with your email.

### Plant data pipeline
```bash
npm run data:aspca       # ASPCA cat/dog toxicity → data/generated/toxicity.json
npm run data:images      # licensed Wikimedia Commons photos → data/generated/images.json
npm run data:perenual    # Perenual species/details (add -- --translate for Arabic via Llama)
npm run data:build       # → data/generated/catalog.json + supabase/seed/seed.sql
npm run verify:llama     # lists Meta Llama models in the provider catalogue + Arabic test call
```

## Testing
```bash
npm test          # vitest: recommendation engine, Nada pipeline (scripted model), DB/RLS in PGlite
npm run lint
npm run typecheck
npm run build
```
`tests/db/rls.test.ts` runs the real migrations and seed in PGlite (in-process Postgres) with
Supabase `auth`/`storage` stubs and checks: customer isolation, role escalation, admin-only writes,
server-priced checkout, stock checks, idempotent "add order plants to My Green Space", storage folders.

## Deployment (Vercel)
1. Import the GitHub repo in Vercel (framework: Next.js).
2. Add the environment variables above (Production + Preview).
3. Deploy; then add the deployment URL to Supabase Auth redirect URLs.

## Demo limitations
- Prices/stock/orders are simulated; checkout takes no payment and nothing ships.
- Rate limiting is in-memory per server instance.
- Care "reminders" are in-app suggestions only (no push notifications or background jobs).
- Plant photo identification (vision) is not implemented — documented as future work.
- Product photos are hot-linked from Wikimedia Commons with licence attribution.

## Credits
Plant photos: Wikimedia Commons contributors (licence + author on each product page).
Pet toxicity: ASPCA Animal Poison Control plant lists. Botanical data: Perenual, RHS, Missouri Botanical Garden.
