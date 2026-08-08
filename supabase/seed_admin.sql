-- After applying schema migrations, create an admin user in Auth (email/password),
-- then run this (replace email if needed):

-- update public.profiles
-- set role = 'admin'
-- where email = 'admin@geram.ir';

-- update auth.users
-- set raw_app_meta_data =
--   coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where email = 'admin@geram.ir';
