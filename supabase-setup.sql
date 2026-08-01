-- ============================================================
--  H. Properties — Supabase setup
--  Run this once in your Supabase project:
--  Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- ============================================================

-- 1) Posts table -------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  title       text not null,
  body        text,
  link        text,
  images      jsonb not null default '[]'::jsonb
);

alter table public.posts enable row level security;

-- Everyone (visitors) can READ posts
drop policy if exists "posts public read" on public.posts;
create policy "posts public read"
  on public.posts for select
  to anon, authenticated
  using (true);

-- Only logged-in admins can create / edit / delete
drop policy if exists "posts admin write" on public.posts;
create policy "posts admin write"
  on public.posts for all
  to authenticated
  using (true) with check (true);

-- 2) Image storage bucket ---------------------------------------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Everyone can view images
drop policy if exists "post-images public read" on storage.objects;
create policy "post-images public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'post-images');

-- Only logged-in admins can upload / change / delete images
drop policy if exists "post-images admin write" on storage.objects;
create policy "post-images admin write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'post-images')
  with check (bucket_id = 'post-images');

-- ============================================================
--  After running this:
--  - Authentication -> Users -> "Add user" -> create your admin
--    login (email + password). Use those to log into /admin.html
--  - Put your Project URL + anon key into config.js
-- ============================================================
