-- ============================================================
--  H. Properties — Financial system (costing + income + P/L)
--  PRIVATE data: authenticated admin only (no public access).
--  Run once: Supabase -> SQL Editor -> paste -> Run
-- ============================================================

-- 1) Projects -------------------------------------------------
create table if not exists public.fin_projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  budget     numeric not null default 0,
  status     text not null default 'running',   -- running | completed | on-hold
  started_on date,
  created_at timestamptz not null default now()
);

-- 2) Categories (self-referential; parent_id null = top category)
create table if not exists public.fin_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  parent_id  uuid references public.fin_categories(id) on delete cascade,
  kind       text not null default 'cost' check (kind in ('cost','income')),
  created_at timestamptz not null default now()
);

-- 3) Transactions (both cost and income) ----------------------
create table if not exists public.fin_transactions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.fin_projects(id) on delete set null,
  category_id uuid references public.fin_categories(id) on delete set null,
  type        text not null check (type in ('cost','income')),
  amount      numeric not null,
  note        text,
  txn_date    date not null default current_date,
  photo_path  text,
  created_at  timestamptz not null default now()
);
create index if not exists fin_txn_project_idx  on public.fin_transactions(project_id);
create index if not exists fin_txn_category_idx on public.fin_transactions(category_id);
create index if not exists fin_txn_date_idx     on public.fin_transactions(txn_date);

-- 4) RLS: authenticated admin only (financial data is private) --
alter table public.fin_projects     enable row level security;
alter table public.fin_categories   enable row level security;
alter table public.fin_transactions enable row level security;

drop policy if exists "fin_projects admin" on public.fin_projects;
create policy "fin_projects admin" on public.fin_projects
  for all to authenticated using (true) with check (true);

drop policy if exists "fin_categories admin" on public.fin_categories;
create policy "fin_categories admin" on public.fin_categories
  for all to authenticated using (true) with check (true);

drop policy if exists "fin_transactions admin" on public.fin_transactions;
create policy "fin_transactions admin" on public.fin_transactions
  for all to authenticated using (true) with check (true);

-- 5) Private storage bucket for receipt photos ----------------
insert into storage.buckets (id, name, public)
values ('cost-photos', 'cost-photos', false)
on conflict (id) do nothing;

drop policy if exists "cost-photos admin" on storage.objects;
create policy "cost-photos admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'cost-photos')
  with check (bucket_id = 'cost-photos');

-- 6) Seed categories (idempotent) -----------------------------
-- top cost groups
insert into public.fin_categories (name, kind)
select v.name, 'cost'
from (values ('Core materials'),('Labour & finishing'),('Utilities & services'),('Other/misc')) v(name)
where not exists (
  select 1 from public.fin_categories c
  where c.kind='cost' and c.parent_id is null and c.name = v.name
);

-- cost subcategories
insert into public.fin_categories (name, kind, parent_id)
select s.name, 'cost', p.id
from (values
  ('Core materials','সিমেন্ট (Cement)'),
  ('Core materials','রড / স্টিল (Rod/Steel)'),
  ('Core materials','বালি (Sand)'),
  ('Core materials','ইট (Brick)'),
  ('Core materials','পাথর / খোয়া (Stone chips)'),
  ('Labour & finishing','মজুরি (Labour)'),
  ('Labour & finishing','টাইলস (Tiles)'),
  ('Labour & finishing','রং (Paint)'),
  ('Labour & finishing','থাই-অ্যালুমিনিয়াম (Thai-aluminium)'),
  ('Labour & finishing','কাঠ (Wood)'),
  ('Utilities & services','ইলেকট্রিক (Electrical)'),
  ('Utilities & services','স্যানিটারি (Sanitary)'),
  ('Utilities & services','গ্রীল (Grille)'),
  ('Utilities & services','পাইলিং (Piling)'),
  ('Other/misc','পরিবহন (Transport)'),
  ('Other/misc','অনুমোদন / ফি (Approval/Fee)'),
  ('Other/misc','বিবিধ (Misc)')
) s(parent, name)
join public.fin_categories p on p.kind='cost' and p.parent_id is null and p.name = s.parent
where not exists (
  select 1 from public.fin_categories c
  where c.kind='cost' and c.parent_id = p.id and c.name = s.name
);

-- income categories
insert into public.fin_categories (name, kind)
select v.name, 'income'
from (values
  ('বুকিং / অগ্রিম (Booking/Advance)'),
  ('কিস্তি (Installment)'),
  ('ফ্ল্যাট / জমি বিক্রয় (Flat/Land sale)'),
  ('অন্যান্য আয় (Other income)')
) v(name)
where not exists (
  select 1 from public.fin_categories c
  where c.kind='income' and c.parent_id is null and c.name = v.name
);
