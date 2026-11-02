-- Secure admin provisioning: run in the Supabase SQL editor (or via the Supabase MCP) as the
-- project owner. Customers cannot change `role` themselves (column privilege + RLS).
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'REPLACE_WITH_ADMIN_EMAIL');
