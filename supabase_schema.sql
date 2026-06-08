-- ============================================================
-- BRIXNODE — FULL Supabase schema (v3)
-- Run this in the Supabase SQL editor. Safe to re-run.
-- Create a PUBLIC storage bucket named "uploads" in the dashboard.
-- ============================================================

-- PROFILES ----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text default '',
  username text unique,
  bio text default '',
  avatar_url text default '',
  banner_url text default '',
  role text default 'buyer',
  is_creator boolean default false,
  payout_method text default '',
  payout_details text default '',
  referral_name text default '',
  referred_by text default '',
  links text default '',
  phone text default '',
  country text default '',
  balance numeric default 0,
  status text default 'active',
  store_name text default '',
  store_status text default 'active',
  store_theme jsonb default '{}',
  store_blocks jsonb default '[]',
  created_at timestamptz default now()
);
alter table public.profiles add column if not exists referred_by text default '';
alter table public.profiles add column if not exists phone text default '';
alter table public.profiles add column if not exists country text default '';
alter table public.profiles add column if not exists balance numeric default 0;
alter table public.profiles add column if not exists status text default 'active';
alter table public.profiles add column if not exists store_name text default '';
alter table public.profiles add column if not exists store_status text default 'active';
alter table public.profiles add column if not exists store_theme jsonb default '{}';
alter table public.profiles add column if not exists store_blocks jsonb default '[]';

-- PRODUCTS ----------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  slug text,
  type text default 'other',
  short_desc text default '',
  description text default '',
  price numeric default 0,
  is_recurring boolean default false,
  tags text[] default '{}',
  category text default '',
  cover_url text default '',
  gallery text[] default '{}',
  preview_text text default '',
  whats_included text default '',
  status text default 'published',
  featured boolean default false,
  views int default 0,
  rating numeric default 0,
  rating_count int default 0,
  delivery jsonb default '{}',
  stock_items jsonb default '[]',
  stock_count int default 0,
  created_at timestamptz default now()
);
alter table public.products add column if not exists delivery jsonb default '{}';
alter table public.products add column if not exists stock_items jsonb default '[]';
alter table public.products add column if not exists stock_count int default 0;

-- ORDERS ------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.profiles(id) on delete set null,
  product_id uuid references public.products(id) on delete cascade,
  creator_id uuid references public.profiles(id) on delete set null,
  amount numeric default 0,
  status text default 'pending',
  proof_url text default '',
  payment_reference text default '',
  payment_method text default '',
  admin_note text default '',
  payout_status text default 'unpaid',
  contact_email text default '',
  contact_whatsapp text default '',
  access_token text default '',
  delivered_payload jsonb default '{}',
  created_at timestamptz default now()
);
alter table public.orders add column if not exists contact_email text default '';
alter table public.orders add column if not exists contact_whatsapp text default '';
alter table public.orders add column if not exists access_token text default '';
alter table public.orders add column if not exists delivered_payload jsonb default '{}';

-- REVIEWS -----------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete cascade,
  rating int default 5,
  comment text default '',
  created_at timestamptz default now()
);

-- PAYMENT METHODS (admin managed) -----------------------------
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  icon text default 'card',
  details text default '',
  active boolean default true
);

-- API KEYS (admin managed) ------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  key_value text default '',
  model text default '',
  active boolean default true
);

-- NOTIFICATIONS ----------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text default '',
  body text default '',
  read boolean default false,
  broadcast boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications add column if not exists broadcast boolean default false;

-- WALLET TRANSACTIONS ----------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text default 'deposit',
  amount numeric default 0,
  status text default 'pending',
  method text default '',
  details text default '',
  proof_url text default '',
  admin_note text default '',
  created_at timestamptz default now()
);

-- PAYOUT REQUESTS --------------------------------------------
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  amount numeric default 0,
  method text default '',
  details text default '',
  status text default 'pending',
  admin_note text default '',
  created_at timestamptz default now()
);

-- SUPPORT TICKETS --------------------------------------------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  subject text default '',
  message text default '',
  reply text default '',
  status text default 'open',
  created_at timestamptz default now()
);

-- COURSE PROGRESS --------------------------------------------
create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  completed_lessons text[] default '{}',
  updated_at timestamptz default now()
);
create unique index if not exists progress_user_product on public.progress(user_id, product_id);

-- Auto-create profile on signup ------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, username, store_name, referred_by)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)) || '''s Store',
    coalesce(new.raw_user_meta_data->>'referred_by','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ADMIN helper (checks role in profiles) ---------------------
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- RLS ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.payment_methods enable row level security;
alter table public.api_keys enable row level security;
alter table public.notifications enable row level security;
alter table public.transactions enable row level security;
alter table public.payout_requests enable row level security;
alter table public.tickets enable row level security;
alter table public.progress enable row level security;

-- DROP existing policies to re-run safely
do $$ declare r record; begin
  for r in (select schemaname, tablename, policyname from pg_policies where schemaname='public') loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- PROFILES
create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id or public.is_admin());
create policy "profiles self insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles admin delete" on public.profiles for delete using (public.is_admin());

-- PRODUCTS
create policy "products readable" on public.products for select using (true);
create policy "creator manage products" on public.products for all
  using (creator_id = auth.uid() or public.is_admin())
  with check (creator_id = auth.uid() or public.is_admin());

-- ORDERS
create policy "orders read" on public.orders for select
  using (buyer_id = auth.uid() or creator_id = auth.uid() or buyer_id is null or public.is_admin());
create policy "orders insert" on public.orders for insert with check (true);
create policy "orders update" on public.orders for update
  using (buyer_id = auth.uid() or public.is_admin());

-- REVIEWS
create policy "reviews readable" on public.reviews for select using (true);
create policy "reviews insert" on public.reviews for insert with check (buyer_id = auth.uid());
create policy "reviews admin" on public.reviews for delete using (public.is_admin());

-- PAYMENT METHODS  (public read, admin write)
create policy "payment methods readable" on public.payment_methods for select using (true);
create policy "payment methods admin" on public.payment_methods for all
  using (public.is_admin()) with check (public.is_admin());

-- API KEYS  (admin only)
create policy "api keys admin" on public.api_keys for all
  using (public.is_admin()) with check (public.is_admin());

-- NOTIFICATIONS
create policy "notifications read" on public.notifications for select
  using (user_id = auth.uid() or broadcast = true or public.is_admin());
create policy "notifications insert" on public.notifications for insert with check (true);
create policy "notifications update" on public.notifications for update
  using (user_id = auth.uid() or public.is_admin());

-- TRANSACTIONS
create policy "tx read" on public.transactions for select using (user_id = auth.uid() or public.is_admin());
create policy "tx insert" on public.transactions for insert with check (user_id = auth.uid() or public.is_admin());
create policy "tx update" on public.transactions for update using (public.is_admin());

-- PAYOUT REQUESTS
create policy "payout read" on public.payout_requests for select using (user_id = auth.uid() or public.is_admin());
create policy "payout insert" on public.payout_requests for insert with check (user_id = auth.uid());
create policy "payout update" on public.payout_requests for update using (public.is_admin());

-- TICKETS
create policy "ticket read" on public.tickets for select using (user_id = auth.uid() or public.is_admin());
create policy "ticket insert" on public.tickets for insert with check (user_id = auth.uid());
create policy "ticket update" on public.tickets for update using (public.is_admin());

-- PROGRESS
create policy "progress all" on public.progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- DONE. Admin actions now work via the anon client because is_admin()
-- checks the signed-in user's role in profiles.
