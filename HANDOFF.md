# HANDOFF — AL NADA | الندى

_Last updated: 2026-11-02 by Claude Code (Opus 5.5)._ Read `CLAUDE.md` for rules and `README.md` for setup.

## Status at a glance
| Area | State |
|---|---|
| Storefront (home, shop, categories, product pages) | ✅ Built, runs on curated local catalogue; visually checked in browser |
| Catalogue data (50 species, 76 products, 21 categories) | ✅ Generated; ASPCA toxicity fetched & matched; Wikimedia images resolved |
| Supabase schema, RLS, functions, storage policies | ✅ Written + tested in PGlite · ❌ **not yet applied to a real project** |
| Auth, cart sync, checkout, orders, My Green Space, admin | ✅ Code complete, type-checked, builds · ⚠️ **untested against live Supabase** |
| Nada AI pipeline (Meta Llama) | ✅ Implemented + 18 pipeline tests with scripted model · ❌ **no real Llama call yet** |
| Cloudflare Workers AI provider | ✅ Configured in code · ❌ credentials not provided yet |
| Perenual import | ✅ Script written · ❌ not run (no API key yet) |
| Vercel deployment | ❌ Not deployed (no Vercel access in this session) |

- **Branch:** `main` · **Remote:** https://github.com/Nadaalnashwan/alnada
- **Latest pushed commit:** see `git log -1 origin/main` (this file is committed in that push).

## Blockers (need the project owner)
1. **Supabase project `alnada`** — free-tier limit reached (2 active projects). Owner will free a slot.
   Then: create project → apply `supabase/migrations/20261102000001_init_schema.sql` → run `supabase/seed/seed.sql`
   → set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` → add auth redirect URLs → grant admin
   (`supabase/admin/grant-admin.sql`). Do **not** use the existing `nada` or `Hudhud AI` projects.
2. **Cloudflare Workers AI** — fill `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Workers AI Read+Edit) in
   `.env.local`, then `npm run verify:llama` (lists Meta models from the live catalogue + Arabic test).
   Default model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` is **unverified** until that script passes.
3. **Perenual** — fill `PERENUAL_API_KEY`, run `npm run data:perenual` (free plan ≈100 req/day; resumable),
   then `npm run data:build` and re-run the seed.

## Architecture summary
- `lib/catalog/repo.ts`: catalogue from Supabase (anon, cached 60 s, tag `catalog`) or `data/generated/catalog.json`.
- `lib/recommendations/engine.ts`: hard constraints (stock, ASPCA pet safety, placement, light, Saudi heat, budget) → weighted score.
- `lib/ai/nada.ts`: `runNada()` — Llama JSON intent → Zod → per-intent server logic via `NadaData` (RLS-scoped,
  `lib/ai/supabase-data.ts`) → Llama reply grounded in FACTS → UI blocks. Intents: recommend_plant, cheaper_options,
  get_plant_care, investigate_plant_problem, get_my_plants, get_plant_history, get_explored_history, save_care_log,
  save_plant, save_to_wishlist, add_to_cart (client action), compare_plants, general_question, clarify_request.
- `app/api/chat/route.ts`: rate limit (in-memory), session persistence (`chat_sessions.context` holds prefs,
  last_recommended ids, focus plant), error codes `AI_NOT_CONFIGURED|AI_TIMEOUT|AI_UPSTREAM|AI_RATE_LIMITED`.
- Checkout: `place_demo_order(p_items, p_contact)` (SECURITY DEFINER) prices from DB, locks + decrements stock,
  clears cart. `add_order_plants_to_space(order_id)` — one `user_plants` row per unit, idempotent.

## Supabase schema (public)
profiles (role protected) · plant_species (botanical cache, toxicity, perenual_data) · categories · products ·
product_categories · carts · cart_items · orders · order_items · wishlists · explored_plants (unique user+species) ·
user_plants (source store_purchase|manual, unconfirmed IDs, photo_path, unique order_item_id+unit_index) ·
care_logs · chat_sessions · chat_messages · recommendation_logs (non-sensitive criteria).
Functions: is_admin, handle_new_user (trigger), place_demo_order, add_order_plants_to_space, admin_store_stats.
Storage: `plant-photos` (private, `<uid>/…`), `product-images` (public read, admin write).

## AI model & provider
Meta Llama via Cloudflare Workers AI OpenAI-compatible endpoint
`https://api.cloudflare.com/client/v4/accounts/<id>/ai/v1/chat/completions`. Groq kept as `LLAMA_PROVIDER=groq`.
**Real API call: not yet performed** (no credentials). Vision/photo ID: not implemented (future work).

## Environment variables
See `.env.example`. Server-only: `LLAMA_PROVIDER`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `LLAMA_MODEL`,
`GROQ_API_KEY`, `PERENUAL_API_KEY`. Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Test results (executed 2026-11-02)
- `npm test`: **38/38 passed** — recommendations (10), Nada pipeline (18, scripted model), DB/RLS/checkout in PGlite (10).
- `npm run lint`: clean · `npm run typecheck`: clean · `npm run build`: success (34 routes).
- Browser check (dev): home, product page, Nada AI page (shows "not configured" state) rendered correctly.
- **Not yet tested:** live Supabase auth/RLS, real Llama responses, mobile layouts in detail, Arabic prompt quality.

## Known issues / limitations
- Rate limiting is per-instance memory. Product images hot-link Wikimedia (consider mirroring to Storage).
- A few Wikimedia lead images are botanical illustrations (e.g. lavender) rather than photos.
- Cloudflare compat endpoint is called without JSON mode; `extractJson()` + Zod handle wrapped JSON.
- Admin image management takes a URL (allowed hosts) rather than file upload to `product-images`.

## Exact next tasks
1. Once credentials exist: `npm run verify:llama` → set `LLAMA_MODEL` to a listed `@cf/meta/*` model → run the
   16 test scenarios from the brief in the browser (Arabic), tune `lib/ai/prompts.ts` if intent extraction misses.
2. Create Supabase `alnada`, apply migration + seed, run `get_advisors` (security/performance), test two-user isolation live.
3. `npm run data:perenual -- --translate`, review Arabic translations, `npm run data:build`, re-seed.
4. Deploy to Vercel with env vars; add the URL to Supabase Auth redirects.
5. Polish: mobile QA pass, admin product image upload to `product-images`, optional Llama vision (only if a
   Meta multimodal model is verified on the provider).
