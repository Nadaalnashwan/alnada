# HANDOFF — AL NADA | الندى

_Last updated: 2026-11-02 by Claude Code (Opus 5.5)._ Read `CLAUDE.md` for rules and `README.md` for setup.

## Status at a glance
| Area | State |
|---|---|
| Storefront (home, shop, categories, product pages) | ✅ Live on Supabase data; Arabic RTL + English checked in browser |
| Catalogue (50 species, 76 products, 21 categories) | ✅ Seeded in Supabase `ALNADA`; ASPCA toxicity; Wikimedia photos; Perenual data for 40 species |
| Supabase schema, RLS, functions, storage | ✅ **Applied to live project** (3 migrations) · advisors reviewed |
| Auth, Green Space, care logs, wishlist, cart, checkout | ✅ **Tested live** (`npm run test:live`: 25/25) |
| Nada AI with real Meta Llama (Cloudflare) | ✅ **Tested live** (`npm run test:app`: 20/20 on clean runs; see "LLM variance") |
| Perenual import | ✅ 40/50 species matched, 16 with details, 15 Arabic translations (validated) |
| Vercel deployment | ❌ Not deployed yet |

- **Branch:** `main` · **Remote:** https://github.com/Nadaalnashwan/alnada · latest pushed commit: `git log -1 origin/main`.
- **Local folder:** `~/Desktop/alnada` (Desktop is synced to iCloud — see Known issues).

## Live services
| Service | Configuration | Verified |
|---|---|---|
| Meta Llama | Cloudflare Workers AI, `LLAMA_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast` | `npm run verify:llama` lists 7 Meta models incl. this one; Arabic completion OK (~3.4 s) |
| Supabase | Project **ALNADA** `sujsqssuwxveztugtiwu` (eu-west-2), publishable key `sb_publishable_…` | REST + Auth reachable; migrations + seed applied via Supabase MCP |
| Perenual | Free plan (100 req/day; details only for ids ≤ 3000) | Import run on 2026-11-02 |

Other Meta models available on the account: `llama-4-scout-17b-16e-instruct` and `llama-3.2-11b-vision-instruct`
(multimodal) — candidates for the optional plant-photo feature; not implemented yet.

## Database (live)
Migrations applied (in order) — files in `supabase/migrations/`:
1. `20261102000001_init_schema.sql` — tables, RLS, `place_demo_order`, `add_order_plants_to_space`, `admin_store_stats`, storage buckets/policies.
2. `20261102000002_advisor_hardening.sql` — trigger fn not callable via API, FK indexes, split admin policies.
3. `20261102000003_explicit_api_grants.sql` — **required**: this project does not auto-grant table privileges to
   `anon`/`authenticated`; grants are explicit and least-privilege; `TRUNCATE/TRIGGER/REFERENCES` revoked (TRUNCATE bypasses RLS).

Seed: `supabase/seed/seed.sql` (76 products / 50 species / 21 categories / 383 links). It was loaded by fetching the
file from GitHub at commit `24467b8` inside Postgres with a SHA-256 check, then the `http` extension was dropped.

Remaining advisor notes (intentional): `place_demo_order`, `add_order_plants_to_space`, `admin_store_stats`, `is_admin`
are SECURITY DEFINER RPCs callable by signed-in users by design (each checks `auth.uid()`/admin internally).
`rls_auto_enable()` is created by Supabase itself — left untouched.

**Test accounts:** `alnada.test.a@example.com`, `alnada.test.b@example.com` (customers; created directly in `auth.users`,
no email sent; password only in the owner's `.env.local` as `TEST_PASSWORD`). Delete them before a public launch:
`delete from auth.users where email like 'alnada.test.%@example.com';`
**Admin:** none yet — run `supabase/admin/grant-admin.sql` with the owner's email after signing up.

## Bugs found during live testing (all fixed + covered by tests)
- Missing API grants on the new Supabase project → catalogue/private reads failed → migration 3 (+ PGlite stubs now mirror it).
- `anon` lacked EXECUTE on `is_admin()` used in public policies (fixed earlier).
- Perenual: paywall placeholder strings, plan-restricted ids misread as quota exhaustion, loose genus match for hybrids.
- Llama translation/replies contained stray CJK/Vietnamese glyphs → validation + retry (+ strip as last resort).
- Llama returned `city: "رياض"` → Riyadh not detected as hot → mint recommended for afternoon sun. City matching normalised.
- Llama sometimes omitted/negated `afternoon_sun`, pets, `reference_index` → deterministic backstops (`detectHardPreferences`, `detectOrdinal`).
- Llama said "لم أستطع" after a successful DB write, and once echoed the FACTS block → truthfulness + leak guards
  (`must_state`, regenerate, fall back to the server confirmation).
- Llama copied a style example verbatim (invented "لولو" for a guest) → example removed; English uses `RESPOND_SYSTEM_EN`.
- English questions got Arabic replies → reply language is set from the user's message script.
- "أسقيها يوميًا" could be logged as a watering → care logs require past-tense completed actions (`CARE_DONE`).

## LLM variance (honest note)
`npm run test:app` drives 20 checks through real Llama. After the fixes, clean runs pass 20/20 (twice in a row);
individual runs occasionally failed on a model routing choice before the matching backstop existed. Cloudflare's
free tier returned **429 (`AI_RATE_LIMITED`)** after many back-to-back calls — the UI shows the error, never a fake reply
(this exercised brief Test 14 for real). Re-run the suite after the daily allowance resets.

## Test results (executed 2026-11-02)
- `npm test`: **53/53** (recommendations 11, Nada pipeline 26 with scripted model, DB/RLS/grants in PGlite 16).
- `npm run test:live`: **25/25** against Supabase ALNADA with the publishable key.
- `npm run test:app`: **20/20** on clean runs against the running app with real Llama (see variance note).
- `npm run lint`: clean · `npm run typecheck`: clean · `npm run build`: see latest commit message.
- Browser: Arabic & English chat, recommendation cards, product pages, mobile shop layout.

## Known issues / limitations
- **Project lives in iCloud-synced Desktop** → `node_modules` syncing makes tsc/builds hang. Move to e.g. `~/Developer/alnada`.
- Rate limiting is in-memory per instance; Cloudflare free-tier quota is the practical AI limit.
- Perenual descriptions are marketing-style and its pet flags conflict with ASPCA (e.g. Aloe vera, Ficus lyrata) —
  stored in `plant_species.perenual_data` for cross-checking only, never shown as pet-safety info.
- 10 species have no Perenual match on the free plan (cached as misses).
- Admin product image = URL (allowed hosts), not file upload. No plant-photo identification yet.

## Exact next tasks
1. Move the repo out of iCloud Desktop; `npm ci`.
2. Sign up the owner account, run `supabase/admin/grant-admin.sql`, check `/admin` live.
3. Deploy to Vercel: env vars from `.env.example` (no TEST_* vars), add `<vercel-url>/auth/callback` to Supabase Auth redirect URLs.
4. Re-run `npm run test:app` after the Cloudflare quota resets; consider `@cf/meta/llama-3.1-8b-instruct-fp8` for the cheap
   intent-JSON call and keep 70B for replies, to cut neuron usage.
5. Optional: plant-photo analysis with `@cf/meta/llama-4-scout-17b-16e-instruct` (verify vision input on Workers AI first).
6. Delete the two test users before public launch.
