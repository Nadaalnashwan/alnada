-- Explicit, least-privilege table privileges for the Data API roles.
-- Newer Supabase projects do not auto-grant API access to new tables, so access is declared here.
-- RLS policies still decide WHICH rows each role can touch; these grants decide WHICH operations exist.

-- TRUNCATE bypasses RLS and TRIGGER/REFERENCES are never needed by API clients.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- Public catalogue: read for everyone; writes only for signed-in users (RLS restricts to admins).
grant select on public.plant_species, public.categories, public.products, public.product_categories to anon, authenticated;
grant insert, update, delete on public.plant_species, public.categories, public.products, public.product_categories to authenticated;

-- Profiles: read own row; only non-privileged columns are updatable (role is never writable).
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, city, preferred_locale) on public.profiles to authenticated;

-- Customer-owned data (RLS limits every row to its owner).
grant select, insert, update, delete on
  public.carts, public.cart_items, public.wishlists, public.explored_plants,
  public.user_plants, public.care_logs, public.chat_sessions, public.chat_messages
  to authenticated;

-- Orders are created only through place_demo_order(); clients may read their own.
grant select on public.orders, public.order_items to authenticated;

-- Recommendation logs: append-only for clients; admin reads via RLS.
grant insert on public.recommendation_logs to anon, authenticated;
grant select on public.recommendation_logs to authenticated;
