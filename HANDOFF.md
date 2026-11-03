# HANDOFF — AL NADA | الندى

_Last updated: 2026-11-03 by Claude Code (Opus 5.5)._ Read `CLAUDE.md` for rules and `README.md` for setup.

## Status at a glance
| Area | State |
|---|---|
| Storefront (home, shop, categories, product pages) | ✅ Live on Supabase data; Arabic RTL + English checked in browser |
| Catalogue (50 species, 76 products, 21 categories) | ✅ Seeded in Supabase `ALNADA`; ASPCA toxicity; Wikimedia photos; Perenual data for 40 species |
| Supabase schema, RLS, functions, storage | ✅ **Applied to live project** (3 migrations) · advisors reviewed |
| Auth, Green Space, care logs, wishlist, cart, checkout | ✅ **Tested live** (`npm run test:live`: 25/25) |
| Nada AI with real Meta Llama (Cloudflare) | ✅ **Tested live** (`npm run test:app`: 20/20 on clean runs; see "LLM variance") |
| Perenual import | ✅ 40/50 species matched, 16 with details (all preserved in Supabase), 15 Arabic translations (Aglaonema pending, see below) |
| Vercel deployment | 🟡 Project `alnada` connected to GitHub `main`; **ready to deploy** (env vars below) |

- **Branch:** `main` (design branch merged 2026-11-03, fast-forward) · **Remote:** https://github.com/Nadaalnashwan/alnada · latest pushed commit: `git log -1 origin/main`.
- **Local folder:** `~/Developer/alnada` (moved out of iCloud-synced Desktop on 2026-11-02; Git history, `.env.local`
  and all sources preserved; `npm ci` re-run). The old `~/Desktop/alnada` copy is obsolete — delete it once you're happy.

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

## Design branch `design/botanical-redesign` (merged into `main` on 2026-11-03)
"Living Botanical" design system, redesigned homepage/shop/Nada AI, official logo + icons, and My Green Space as a
shared interactive garden shelf with a selectable details panel (real Supabase data; watering updates the DB and UI).
Catalogue photos are mirrored locally (`npm run data:mirror`). The homepage hero **is** the garden (customer's own
plants; labelled sample plants for visitors). Merge via PR after review.

## My Green Space care checklist (added 2026-11-03)
Checklist tasks are recurring care activities (`lib/green-space/care-tasks.ts`): watering (species interval 4/7/14 d;
"التربة رطبة" records a soil check that also completes it), wiping leaves (14 d), light feeding (30 d, succulents 60 d)
and refreshing soil/repotting (365 d) — the non-watering intervals are labelled as general guidance. Ticking a task
saves a **real care log** via the existing `POST /api/care-logs` (RLS), so completion persists; it is shown as done only
after Supabase returns the row, repeated clicks / the same action twice in a day are not saved twice, and a failed save
shows an error. Advice ("away from AC", "better light") is confirmed by the customer and saved as a marked observation
(`lib/green-space/care-notes.ts`); markers are excluded from health observations and a soil check clears
`soil_check_due` in `insights.ts` without counting as a watering. No migration. Companion lines, the plant journey and
the attention dot on pots come only from saved records. No notifications or automatic reminders exist.

## Nada AI personal plant recognition (added 2026-11-03)
**Bug:** "وش الإضاءة المناسبة لفله؟" (customer owns a jasmine nicknamed "فله") got a Philodendron guess. Saved plants
were only matched when Llama filled `plant_nickname` *and* chose a care intent; for a "general question" with "فله"
read as a species, no plant facts reached the reply. Joined prefixes / spelling variants were never matched.
**Fix:** `lib/ai/user-plant-match.ts` finds the signed-in customer's own plants in the message before any generic
interpretation — nicknames with Arabic variants (ة/ه, ى/ي, hamza forms, shadda/diacritics, tatweel, article) and
joined prefixes (و ف ب ل ك + ال), plus species names of plants they own. A typed nickname wins over the sidebar
selection, the model's guess and earlier recommendations; duplicates ask which plant; the plant stays in focus for
follow-ups ("أسقيها", "هي") via `last_focus` in `chat_sessions.context` (survives reloads). Llama now also gets
nickname→species pairs. Tests: `tests/nada-user-plants.test.ts` (19, mocked). Live check: "لياسمينه" → saved ياسمينة.

## Nada AI conversation memory (added 2026-11-03)
**Bug:** after Nada listed Zinnia/Papaya in her reply, "قارني بين الأولى والثانية" showed an Aloe vera card and
"أضيفي الثانية للسلة" added Aloe vera (reproduced against the old code). Root causes: (1) only store-engine picks were
tracked (`last_recommended`); plants Nada listed in her own text were never recorded, so ordinals hit an older group;
(2) `compare_plants` ignored context and used whatever names Llama pulled from history; (3) the species matcher checked
generic aliases first and accepted weak fragments ("صبار"→Aloe vera, "فيكس ليراتا"→Ficus elastica, "نبتة الصبار"→snake plant).
**Fix (no migration — state lives in the existing RLS-protected `chat_sessions.context` jsonb):**
- `lib/ai/conversation.ts`: ordered recommendation groups (`rec_sets`, max 6, oldest kept for "الخيارات السابقة"),
  `active_set` (latest group), `focus_item` (the one plant being discussed — never reorders the group), `compared`,
  `last_action` (answers "وش أضفتي؟", blocks an identical repeated request). Deterministic resolver for الأولى/الثانية/
  الثالثة, آخر وحدة, آخر نبتتين, قارني بينهم, هذي/ذيك/أضيفيها, the older/first group, "وش أضفتي"; ambiguous → clarification.
  "أي وحدة أرخص / تحتاج ري أقل / أسهل / آمنة للقطط" is computed from catalogue prices / verified species data (tie or
  missing data → no winner). Numbered plant lists in Nada's reply become the new active group.
- `lib/ai/species-match.ts`: strict matching (exact name → exact alias → whole-word part of one name → longest contained
  name); generic names return candidates for clarification instead of a guess.
- Cart/wishlist/product cards use only validated catalogue products of the exact species (`storeProductsFor`); a plant
  not sold at AL NADA gets a `notice` block / failed action — never a substitute. Several products of one species → choice.
- Old saved sessions (only `last_recommended`) are migrated on read. Prompts tell Llama to compare only `FACTS.compare`.
- Tests: `tests/nada-references.test.ts` (41, mocked Llama: scenarios A–G + spec scenario + duplicates + budget),
  RLS test for `chat_sessions.context` privacy. One live check (2026-11-03): recommendation saved as the active group in
  card order.

## Nada AI ↔ customer data (added 2026-11-02, second session)
`lib/green-space/insights.ts` derives record-based insights from saved data only: days since the last *recorded*
watering vs the species' typical check interval (low 14 / moderate 7 / high 4 days — a prompt to check soil, not a
schedule), recorded light vs species needs, recent health observations, and need-based products (e.g. humidifier for
high-humidity species). Used by Nada (`record_based_insights` in FACTS + status flags on plant cards: "افحص التربة",
"الإضاءة غير مناسبة", "ما فيه ري مسجل", "ملاحظة صحية") **and** by the plant page suggestions, so both always agree.
Optional `LLAMA_INTENT_MODEL` lets the short JSON intent call use a cheaper Meta model (default: same as `LLAMA_MODEL`).

## Bugs found during live testing (all fixed + covered by tests)
- Missing API grants on the new Supabase project → catalogue/private reads failed → migration 3 (+ PGlite stubs now mirror it).
- `anon` lacked EXECUTE on `is_admin()` used in public policies (fixed earlier).
- Perenual: paywall placeholder strings, plan-restricted ids misread as quota exhaustion, loose genus match for hybrids.
- Llama translation/replies contained stray CJK/Vietnamese glyphs → validation + retry (+ strip as last resort).
- Llama returned `city: "رياض"` → Riyadh not detected as hot → mint recommended for afternoon sun. City matching normalised.
- Llama sometimes omitted/negated `afternoon_sun`, pets, `reference_index` → deterministic backstops (`detectHardPreferences`; references now via `lib/ai/conversation.ts`).
- Multi-turn references used outdated groups and fuzzy species matching (Zinnia/Papaya → Aloe vera) → see "Nada AI conversation memory".
- Llama said "لم أستطع" after a successful DB write, and once echoed the FACTS block → truthfulness + leak guards
  (`must_state`, regenerate, fall back to the server confirmation).
- Llama copied a style example verbatim (invented "لولو" for a guest) → example removed; English uses `RESPOND_SYSTEM_EN`.
- English questions got Arabic replies → reply language is set from the user's message script.
- "أسقيها يوميًا" could be logged as a watering → care logs require past-tense completed actions (`CARE_DONE`).
- A Japanese-kana glitch slipped into the stored Aglaonema translation (blocklist missed kana) → validation switched to a
  script **allowlist** (Arabic letters + A–Z only) for both imports and live replies; bad text removed from the DB.

## Cloudflare plan & cost
Upgraded to **Workers Paid** on 2026-11-03 (10,000 neurons/day included, then $0.011 / 1,000 neurons). A Nada message
is 2 Llama 3.3 70B calls (≈230–350 neurons, ≈$0.003 beyond the daily allowance). Daily-quota exhaustion (error 4006)
is now reported as `AI_QUOTA_EXHAUSTED` with the real reset time, not "too many messages".
Keep development tests mocked; `npm run test:app` makes ~40 live calls.

## LLM variance (honest note)
`npm run test:app` drives 20 checks through real Llama. After the fixes, clean runs pass 20/20 (twice in a row);
individual runs occasionally failed on a model routing choice before the matching backstop existed. Cloudflare's
free tier returned **429 (`AI_RATE_LIMITED`)** after many back-to-back calls — the UI shows the error, never a fake reply
(this exercised brief Test 14 for real). Re-run the suite after the daily allowance resets.

## Test results
**2026-11-03 (design branch):** `npm test` **132/132** (incl. 41 reference, 19 personal-plant, 9 care-task tests), lint/typecheck clean, production build OK.

**2026-11-02 (from ~/Developer/alnada):**
- `npm test`: **59/59** (recommendations 11, insights 4, Nada pipeline 28 with scripted model, DB/RLS/grants in PGlite 16).
- `npm run test:live`: **25/25** against Supabase ALNADA with the publishable key (run twice).
- `npm run test:app -- --no-ai`: **18/18** app routes against both `next dev` and the production `next start` server,
  incl. live AI-failure handling (Test 14: `429 AI_RATE_LIMITED`, no fabricated reply).
- `npm run test:app` (real Llama): **20/20** on clean runs earlier today; not re-run after the latest changes because the
  Cloudflare daily quota is exhausted — **re-run first thing after 00:00 UTC**.
- `npm run lint` clean · `npm run typecheck` clean · `npm run build` success (33 routes) · production smoke test: all pages 200.

## Known issues / limitations
- Old `~/Desktop/alnada` copy still exists (iCloud) — obsolete; delete after confirming `~/Developer/alnada`.
- Rate limiting is in-memory per instance; Cloudflare free-tier quota is the practical AI limit.
- Perenual descriptions are marketing-style and its pet flags conflict with ASPCA (e.g. Aloe vera, Ficus lyrata) —
  stored in `plant_species.perenual_data` for cross-checking only, never shown as pet-safety info.
- 10 species have no Perenual match on the free plan (cached as misses).
- Admin product image = URL (allowed hosts), not file upload. No plant-photo identification yet.

## Vercel production
Environment variables (Production scope):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public by design (publishable key; RLS protects data).
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` — **secret**, server-only (no `NEXT_PUBLIC_` prefix).
- Optional: `LLAMA_PROVIDER=cloudflare`, `LLAMA_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast` (these are the defaults).
- Do **not** add `TEST_*`, `PERENUAL_API_KEY` (import scripts only) or `GROQ_API_KEY` (unused provider).
After the first deploy: add `https://<vercel-domain>` as Supabase Auth **Site URL** and `https://<vercel-domain>/auth/callback`
to **Redirect URLs** (sign-up confirmation / password reset links), then smoke-test home, shop, sign-in, Nada AI.

## Exact next tasks
1. Deploy `main` on Vercel with the env vars above; set Supabase Auth Site URL + redirect URL to the Vercel domain.
2. `npm run test:app` (real Llama, ~40 calls) once before release; `npm run data:perenual -- --translate` (Aglaonema),
   `npm run data:build`, update that one row. Optionally try `LLAMA_INTENT_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8` to cut cost.
3. Sign up the owner account, run `supabase/admin/grant-admin.sql`, check `/admin` live.
4. Deploy to Vercel: env vars from `.env.example` (no TEST_* vars), add `<vercel-url>/auth/callback` to Supabase Auth redirect URLs.
5. Delete the two test users before public launch; delete the obsolete `~/Desktop/alnada` copy.
6. Optional: plant-photo analysis with `@cf/meta/llama-4-scout-17b-16e-instruct` (verify vision input first).
