-- AL NADA — initial schema
-- Botanical knowledge (plant_species) is kept separate from commerce (products).
-- All private customer tables are protected by Row Level Security keyed on auth.uid().


-- ─────────────────────────────── helpers ───────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─────────────────────────────── profiles ──────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  city text check (char_length(city) <= 80),
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar', 'en')),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Customers can never change their own role: the column is not updatable by API roles.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, city, preferred_locale) on public.profiles to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
-- anon needs execute too: public catalogue policies reference is_admin() (it simply returns false).
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ─────────────────────────── botanical cache ───────────────────────────
create table public.plant_species (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  scientific_name text not null,
  family text,
  name_en text not null,
  name_ar text not null,
  description_en text not null,
  description_ar text not null,
  light text[] not null,
  water text not null check (water in ('low', 'moderate', 'high')),
  humidity text not null check (humidity in ('low', 'moderate', 'high')),
  temp_min_c smallint,
  temp_max_c smallint,
  placement text[] not null,
  difficulty text not null check (difficulty in ('easy', 'moderate', 'hard')),
  size text not null check (size in ('small', 'medium', 'large')),
  habit text not null,
  heat_tolerant boolean not null default false,
  flowering boolean not null default false,
  aromatic boolean not null default false,
  succulent boolean not null default false,
  tips_en text[] not null default '{}',
  tips_ar text[] not null default '{}',
  problems_en text[] not null default '{}',
  problems_ar text[] not null default '{}',
  perenual_id integer unique,
  perenual_data jsonb,
  botanical_references text[] not null default '{}',
  toxicity_cats text not null default 'unknown' check (toxicity_cats in ('toxic', 'non_toxic', 'unknown')),
  toxicity_dogs text not null default 'unknown' check (toxicity_dogs in ('toxic', 'non_toxic', 'unknown')),
  toxicity_source text,
  toxicity_source_url text,
  toxicity_matched_name text,
  toxicity_verified_at date,
  image jsonb,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plant_species_updated_at before update on public.plant_species for each row execute function public.set_updated_at();
create index plant_species_name_search on public.plant_species using gin (to_tsvector('simple', scientific_name || ' ' || name_en || ' ' || name_ar));

-- ─────────────────────────────── commerce ──────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  sort smallint not null default 0,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  kind text not null check (kind in ('plant', 'gift', 'pot', 'soil', 'accessory')),
  species_id uuid references public.plant_species (id) on delete restrict,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  variant_en text,
  variant_ar text,
  price_sar numeric(10, 2) not null check (price_sar >= 0),
  compare_at_sar numeric(10, 2) check (compare_at_sar is null or compare_at_sar >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  is_new boolean not null default false,
  is_demo boolean not null default true,
  image jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plants_have_species check (kind not in ('plant', 'gift') or species_id is not null)
);
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create index products_species_idx on public.products (species_id);
create index products_active_kind_idx on public.products (is_active, kind);

create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);
create index product_categories_category_idx on public.product_categories (category_id);

-- ─────────────────────────── shopping (private) ────────────────────────
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 20),
  added_at timestamptz not null default now(),
  primary key (cart_id, product_id)
);
create index cart_items_product_idx on public.cart_items (product_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_number text not null unique,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  subtotal_sar numeric(10, 2) not null,
  shipping_sar numeric(10, 2) not null default 0,
  total_sar numeric(10, 2) not null,
  contact jsonb not null default '{}',
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  species_id uuid references public.plant_species (id),
  name_snapshot text not null,
  unit_price_sar numeric(10, 2) not null,
  quantity integer not null check (quantity between 1 and 20)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.wishlists (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index wishlists_product_idx on public.wishlists (product_id);

-- ───────────────────────── My Green Space (private) ────────────────────
create table public.explored_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  species_id uuid not null references public.plant_species (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  reason text check (char_length(reason) <= 300),
  source text not null default 'chat' check (source in ('chat', 'product_view', 'manual')),
  last_explored_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, species_id)
);
create index explored_plants_user_idx on public.explored_plants (user_id, last_explored_at desc);

create table public.user_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  species_id uuid references public.plant_species (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  order_item_id uuid references public.order_items (id) on delete set null,
  unit_index smallint,
  identification_status text not null default 'confirmed' check (identification_status in ('confirmed', 'unconfirmed')),
  unconfirmed_label text check (char_length(unconfirmed_label) <= 120),
  nickname text check (char_length(nickname) <= 60),
  location text check (char_length(location) <= 80),
  light_condition text check (light_condition in ('low', 'medium', 'bright_indirect', 'full_sun')),
  watering_preference text check (char_length(watering_preference) <= 120),
  notes text check (char_length(notes) <= 1000),
  photo_path text,
  source text not null check (source in ('store_purchase', 'manual')),
  acquired_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint species_or_label check (species_id is not null or unconfirmed_label is not null),
  -- one owned-plant record per physical unit of an order line: repeat requests cannot duplicate
  unique (order_item_id, unit_index)
);
create trigger user_plants_updated_at before update on public.user_plants for each row execute function public.set_updated_at();
create index user_plants_user_idx on public.user_plants (user_id, created_at desc);
create index user_plants_species_idx on public.user_plants (species_id);
create index user_plants_nickname_idx on public.user_plants (user_id, lower(nickname));

create table public.care_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_plant_id uuid not null references public.user_plants (id) on delete cascade,
  activity text not null check (activity in ('watering', 'fertilizing', 'repotting', 'pruning', 'cleaning', 'observation')),
  notes text check (char_length(notes) <= 1000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index care_logs_plant_idx on public.care_logs (user_plant_id, occurred_at desc);
create index care_logs_user_idx on public.care_logs (user_id, occurred_at desc);

-- ────────────────────────────── Nada AI ────────────────────────────────
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (char_length(title) <= 120),
  workflow text check (workflow in ('care', 'rescue', 'finder', 'general')),
  context jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger chat_sessions_updated_at before update on public.chat_sessions for each row execute function public.set_updated_at();
create index chat_sessions_user_idx on public.chat_sessions (user_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  payload jsonb,
  created_at timestamptz not null default now()
);
create index chat_messages_session_idx on public.chat_messages (session_id, created_at);
create index chat_messages_user_idx on public.chat_messages (user_id);

-- Non-sensitive aggregate log: criteria only (light, placement, pet requirement, budget band), no free text.
create table public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  criteria jsonb not null,
  product_ids uuid[] not null default '{}',
  result_count smallint not null default 0,
  created_at timestamptz not null default now()
);
create index recommendation_logs_created_idx on public.recommendation_logs (created_at desc);

-- ─────────────────────────────── RLS ───────────────────────────────────
alter table public.profiles enable row level security;
alter table public.plant_species enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.explored_plants enable row level security;
alter table public.user_plants enable row level security;
alter table public.care_logs enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.recommendation_logs enable row level security;

-- profiles
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- public catalogue: readable by everyone, writable by admins only
create policy "species: public read" on public.plant_species for select to anon, authenticated using (true);
create policy "species: admin write" on public.plant_species for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories: public read" on public.categories for select to anon, authenticated using (true);
create policy "categories: admin write" on public.categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products: public read active" on public.products for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy "products: admin insert" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "products: admin update" on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products: admin delete" on public.products for delete to authenticated using ((select public.is_admin()));
create policy "product_categories: public read" on public.product_categories for select to anon, authenticated using (true);
create policy "product_categories: admin write" on public.product_categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- carts
create policy "carts: own" on public.carts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cart_items: own cart" on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));

-- orders: read own (admins read all). Inserts only via place_demo_order().
create policy "orders: read own or admin" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "order_items: read own or admin" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));

-- simple owner-only tables
create policy "wishlists: own" on public.wishlists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "explored_plants: own" on public.explored_plants for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_plants: own" on public.user_plants for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "chat_sessions: own" on public.chat_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- children must also point at a parent the user owns
create policy "care_logs: own plant" on public.care_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.user_plants p where p.id = user_plant_id and p.user_id = (select auth.uid())));
create policy "chat_messages: own session" on public.chat_messages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

-- recommendation logs: anyone may append an anonymous or self-attributed row; only admins read
create policy "recommendation_logs: append" on public.recommendation_logs for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
create policy "recommendation_logs: admin read" on public.recommendation_logs for select to authenticated
  using ((select public.is_admin()));

-- ───────────────────────── transactional functions ─────────────────────
-- Places a DEMO order atomically: prices come from the database, never the client;
-- stock is checked and decremented under row locks; the user's cart is cleared.
create or replace function public.place_demo_order(p_items jsonb, p_contact jsonb default '{}')
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_item record;
  v_subtotal numeric(10, 2) := 0;
  v_shipping numeric(10, 2);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_ORDER'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'TOO_MANY_ITEMS'; end if;

  -- validate & lock
  for v_item in
    select i.product_id, sum(i.quantity)::int as quantity, p.price_sar, p.stock, p.is_active
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity int)
    left join public.products p on p.id = i.product_id
    group by i.product_id, p.price_sar, p.stock, p.is_active
  loop
    if v_item.price_sar is null or not v_item.is_active then raise exception 'PRODUCT_UNAVAILABLE:%', v_item.product_id; end if;
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 20 then raise exception 'INVALID_QUANTITY:%', v_item.product_id; end if;
    perform 1 from public.products where id = v_item.product_id for update;
    if (select stock from public.products where id = v_item.product_id) < v_item.quantity then
      raise exception 'INSUFFICIENT_STOCK:%', v_item.product_id;
    end if;
    v_subtotal := v_subtotal + v_item.price_sar * v_item.quantity;
  end loop;

  v_shipping := case when v_subtotal >= 200 then 0 else 25 end;

  insert into public.orders (user_id, order_number, subtotal_sar, shipping_sar, total_sar, contact)
  values (v_uid, 'ND-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)),
          v_subtotal, v_shipping, v_subtotal + v_shipping,
          jsonb_build_object('name', left(p_contact ->> 'name', 120), 'city', left(p_contact ->> 'city', 80)))
  returning * into v_order;

  insert into public.order_items (order_id, product_id, species_id, name_snapshot, unit_price_sar, quantity)
  select v_order.id, p.id, p.species_id, p.name_ar || ' — ' || p.name_en, p.price_sar, q.quantity
  from (select i.product_id, sum(i.quantity)::int as quantity
        from jsonb_to_recordset(p_items) as i(product_id uuid, quantity int) group by i.product_id) q
  join public.products p on p.id = q.product_id;

  update public.products p set stock = p.stock - q.quantity
  from (select i.product_id, sum(i.quantity)::int as quantity
        from jsonb_to_recordset(p_items) as i(product_id uuid, quantity int) group by i.product_id) q
  where p.id = q.product_id;

  delete from public.cart_items where cart_id in (select id from public.carts where user_id = v_uid);
  return v_order;
end $$;
revoke execute on function public.place_demo_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_demo_order(jsonb, jsonb) to authenticated;

-- Adds the plants from one of the caller's confirmed orders to My Green Space:
-- one record per physical unit; idempotent thanks to unique (order_item_id, unit_index).
create or replace function public.add_order_plants_to_space(p_order_id uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.orders where id = p_order_id and user_id = v_uid and status = 'confirmed') then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  insert into public.user_plants (user_id, species_id, product_id, order_item_id, unit_index, source, acquired_at)
  select v_uid, oi.species_id, oi.product_id, oi.id, gs.n, 'store_purchase', o.created_at::date
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  cross join lateral generate_series(1, oi.quantity) as gs(n)
  where oi.order_id = p_order_id and oi.species_id is not null
  on conflict (order_item_id, unit_index) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.add_order_plants_to_space(uuid) from public, anon;
grant execute on function public.add_order_plants_to_space(uuid) to authenticated;

-- Aggregated, non-sensitive analytics for the admin dashboard.
create or replace function public.admin_store_stats()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'orders', (select count(*) from public.orders where status = 'confirmed'),
    'revenue_sar', (select coalesce(sum(total_sar), 0) from public.orders where status = 'confirmed'),
    'customers', (select count(*) from public.profiles),
    'owned_plants', (select count(*) from public.user_plants),
    'recommendations', (select count(*) from public.recommendation_logs),
    'low_stock', (select count(*) from public.products where is_active and stock < 5),
    'top_products', (select coalesce(jsonb_agg(t), '[]') from (
        select p.id, p.name_ar, p.name_en, sum(oi.quantity)::int as units
        from public.order_items oi join public.products p on p.id = oi.product_id
        group by p.id order by units desc limit 5) t),
    'top_categories', (select coalesce(jsonb_agg(t), '[]') from (
        select c.slug, c.name_ar, c.name_en, sum(oi.quantity)::int as units
        from public.order_items oi join public.product_categories pc on pc.product_id = oi.product_id
        join public.categories c on c.id = pc.category_id
        where c.slug <> 'all-plants'
        group by c.id order by units desc limit 5) t),
    'recommended_products', (select coalesce(jsonb_agg(t), '[]') from (
        select p.id, p.name_ar, p.name_en, count(*)::int as times
        from public.recommendation_logs r cross join lateral unnest(r.product_ids) pid
        join public.products p on p.id = pid
        group by p.id order by times desc limit 5) t),
    'pet_safe_requests', (select count(*) from public.recommendation_logs where criteria ->> 'pets' is not null and criteria ->> 'pets' <> '[]')
  );
end $$;
revoke execute on function public.admin_store_stats() from public, anon;
grant execute on function public.admin_store_stats() to authenticated;

-- ───────────────────────────── storage ─────────────────────────────────
-- plant-photos: private; each user writes only under their own folder: <uid>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plant-photos', 'plant-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
-- product-images: public read, admin write
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "plant-photos: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "plant-photos: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "plant-photos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "product-images: admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product-images: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
