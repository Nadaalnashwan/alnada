-- Fixes from Supabase security/performance advisors after the first live deploy.

-- handle_new_user() is a trigger function only; it must not be callable via /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Covering indexes for foreign keys flagged as unindexed.
create index if not exists explored_plants_product_idx on public.explored_plants (product_id);
create index if not exists explored_plants_species_idx on public.explored_plants (species_id);
create index if not exists order_items_species_idx on public.order_items (species_id);
create index if not exists recommendation_logs_user_idx on public.recommendation_logs (user_id);
create index if not exists user_plants_product_idx on public.user_plants (product_id);

-- "admin write" policies were FOR ALL, which also added a second permissive SELECT policy next to
-- the public read policy. Split them into explicit insert/update/delete policies.
drop policy "species: admin write" on public.plant_species;
create policy "species: admin insert" on public.plant_species for insert to authenticated with check ((select public.is_admin()));
create policy "species: admin update" on public.plant_species for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "species: admin delete" on public.plant_species for delete to authenticated using ((select public.is_admin()));

drop policy "categories: admin write" on public.categories;
create policy "categories: admin insert" on public.categories for insert to authenticated with check ((select public.is_admin()));
create policy "categories: admin update" on public.categories for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories: admin delete" on public.categories for delete to authenticated using ((select public.is_admin()));

drop policy "product_categories: admin write" on public.product_categories;
create policy "product_categories: admin insert" on public.product_categories for insert to authenticated with check ((select public.is_admin()));
create policy "product_categories: admin update" on public.product_categories for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "product_categories: admin delete" on public.product_categories for delete to authenticated using ((select public.is_admin()));
