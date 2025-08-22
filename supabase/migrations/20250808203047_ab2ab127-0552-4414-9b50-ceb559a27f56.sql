
-- ============================================================
-- Supabase Ride Sharing - Full Backup and Schema Setup
-- Safe to run multiple times (idempotent where possible)
-- ============================================================

-- 1) Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 2) Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payout_status') then
    create type public.payout_status as enum ('pending', 'approved', 'rejected', 'paid');
  end if;
end$$;

-- 3) Functions

-- 3.1) set_updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- 3.2) handle_new_user trigger function
-- Inserts a row in public.profiles after a user is created in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
begin
  insert into public.profiles (id, full_name, user_type, phone, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'user_type', 'passenger'),
    nullif(new.raw_user_meta_data->>'phone', ''),
    case
      when coalesce(new.raw_user_meta_data->>'user_type', 'passenger') = 'driver' then false
      else true
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- 3.3) Attach trigger to auth.users (if not already)
-- Note: uses drop if exists to be idempotent
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4) Tables

-- 4.1) admin_setup
create table if not exists public.admin_setup (
  admin_user_id uuid not null,
  password_set boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Unique to allow safe upserts and to ensure single admin row per user
create unique index if not exists admin_setup_admin_user_id_uidx
  on public.admin_setup (admin_user_id);

-- 4.2) profiles
create table if not exists public.profiles (
  id uuid not null,
  full_name text not null,
  user_type text not null,
  phone text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

-- 4.3) pricing_settings (singleton pattern)
create table if not exists public.pricing_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true,
  price_per_km_active boolean not null default true,
  price_per_km numeric not null default 2.5,
  fixed_price_active boolean not null default false,
  fixed_price numeric,
  service_fee_type text not null default 'fixed',
  service_fee_value numeric not null default 0,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique partial index to enforce only one active singleton row
create unique index if not exists pricing_settings_singleton_true_uidx
  on public.pricing_settings (singleton)
  where singleton is true;

-- 4.4) locations
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  speed double precision,
  timestamp timestamptz default now()
);

create index if not exists locations_user_id_idx on public.locations(user_id);

-- 4.5) rides
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null,
  driver_id uuid,
  origin_address text not null,
  destination_address text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  status text not null default 'pending',
  estimated_distance double precision,
  estimated_duration integer,
  estimated_price numeric,
  actual_price numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  -- Pickup phase tracking
  driver_en_route boolean default false,
  en_route_started_at timestamptz,
  driver_to_pickup_distance_km numeric,
  driver_to_pickup_duration_min integer
);

create index if not exists rides_passenger_id_idx on public.rides(passenger_id);
create index if not exists rides_driver_id_idx on public.rides(driver_id);
create index if not exists rides_status_idx on public.rides(status);
create index if not exists rides_created_at_idx on public.rides(created_at);

-- 4.6) driver_payout_requests
create table if not exists public.driver_payout_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null,
  amount numeric not null,
  payment_method text not null,
  payment_details jsonb,
  notes text,
  admin_notes text,
  status public.payout_status not null default 'pending',
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dpr_driver_id_idx on public.driver_payout_requests(driver_id);
create index if not exists dpr_status_idx on public.driver_payout_requests(status);
create index if not exists dpr_created_at_idx on public.driver_payout_requests(created_at);

-- 4.7) ride_ratings
create table if not exists public.ride_ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null,
  driver_id uuid not null,
  passenger_id uuid not null,
  rating integer not null,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists ride_ratings_driver_id_idx on public.ride_ratings(driver_id);
create index if not exists ride_ratings_passenger_id_idx on public.ride_ratings(passenger_id);
create index if not exists ride_ratings_ride_id_idx on public.ride_ratings(ride_id);

-- 4.8) driver_details
create table if not exists public.driver_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  driver_license text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text,
  vehicle_type text not null default 'car',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_details_user_id_idx on public.driver_details(user_id);

-- 5) Row Level Security
alter table public.admin_setup enable row level security;
alter table public.profiles enable row level security;
alter table public.pricing_settings enable row level security;
alter table public.locations enable row level security;
alter table public.rides enable row level security;
alter table public.driver_payout_requests enable row level security;
alter table public.ride_ratings enable row level security;
alter table public.driver_details enable row level security;

-- Policies

-- admin_setup: Allow admin setup access (all)
do $$
begin
  begin
    create policy "Allow admin setup access"
      on public.admin_setup
      as permissive
      for all
      using (true);
  exception when duplicate_object then null;
  end;
end$$;

-- profiles
do $$
begin
  -- Users can view all profiles
  begin
    create policy "Users can view all profiles"
      on public.profiles
      for select
      using (true);
  exception when duplicate_object then null;
  end;

  -- Users can insert own profile
  begin
    create policy "Users can insert own profile"
      on public.profiles
      for insert
      with check (auth.uid() = id);
  exception when duplicate_object then null;
  end;

  -- Users can update own profile
  begin
    create policy "Users can update own profile"
      on public.profiles
      for update
      using (auth.uid() = id);
  exception when duplicate_object then null;
  end;

  -- Admins can update any profile
  begin
    create policy "Admins can update any profile"
      on public.profiles
      for update
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.user_type = 'admin'))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.user_type = 'admin'));
  exception when duplicate_object then null;
  end;
end$$;

-- pricing_settings
do $$
begin
  -- Anyone can read pricing settings
  begin
    create policy "Anyone can read pricing settings"
      on public.pricing_settings
      for select
      using (true);
  exception when duplicate_object then null;
  end;

  -- Only admins can insert pricing settings
  begin
    create policy "Only admins can insert pricing settings"
      on public.pricing_settings
      for insert
      with check (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
  exception when duplicate_object then null;
  end;

  -- Only admins can update pricing settings
  begin
    create policy "Only admins can update pricing settings"
      on public.pricing_settings
      for update
      using (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'))
      with check (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
  exception when duplicate_object then null;
  end;
end$$;

-- locations
do $$
begin
  -- Users can manage own location (ALL)
  begin
    create policy "Users can manage own location"
      on public.locations
      for all
      using (auth.uid() = user_id);
  exception when duplicate_object then null;
  end;
end$$;

-- rides
do $$
begin
  -- Passengers can create rides
  begin
    create policy "Passengers can create rides"
      on public.rides
      for insert
      with check (auth.uid() = passenger_id);
  exception when duplicate_object then null;
  end;

  -- Users can view rides they're involved in or admins can view all
  begin
    create policy "Users can view rides they're involved in or admins can view all"
      on public.rides
      for select
      using (
        (auth.uid() = passenger_id)
        or (auth.uid() = driver_id)
        or (
          status = 'pending'
          and exists (select 1 from public.profiles where id = auth.uid() and user_type = 'driver')
        )
        or exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin')
      );
  exception when duplicate_object then null;
  end;

  -- Drivers can update accepted rides or admins can update any
  begin
    create policy "Drivers can update accepted rides or admins can update any"
      on public.rides
      for update
      using (
        (auth.uid() = driver_id)
        or ((driver_id is null) and (status = 'pending'))
        or exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin')
      );
  exception when duplicate_object then null;
  end;
end$$;

-- driver_payout_requests
do $$
begin
  -- Drivers can create payout requests
  begin
    create policy "Drivers can create payout requests"
      on public.driver_payout_requests
      for insert
      with check (
        auth.uid() = driver_id
        and exists (select 1 from public.profiles where id = auth.uid() and user_type = 'driver')
      );
  exception when duplicate_object then null;
  end;

  -- Drivers can view own payout requests OR admins
  begin
    create policy "Drivers can view own payout requests"
      on public.driver_payout_requests
      for select
      using (
        (auth.uid() = driver_id)
        or exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin')
      );
  exception when duplicate_object then null;
  end;

  -- Admins can update payout requests
  begin
    create policy "Admins can update payout requests"
      on public.driver_payout_requests
      for update
      using (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
  exception when duplicate_object then null;
  end;
end$$;

-- ride_ratings
do $$
begin
  -- Passengers can rate completed rides
  begin
    create policy "Passengers can rate completed rides"
      on public.ride_ratings
      for insert
      with check (
        (passenger_id = auth.uid())
        and exists (
          select 1 from public.rides
          where rides.id = ride_ratings.ride_id
            and rides.passenger_id = auth.uid()
            and rides.status = 'completed'
            and rides.driver_id = ride_ratings.driver_id
        )
      );
  exception when duplicate_object then null;
  end;

  -- Users can view ratings for rides they're involved in or admins
  begin
    create policy "Users can view ratings for rides they're involved in or admins"
      on public.ride_ratings
      for select
      using (
        (passenger_id = auth.uid())
        or (driver_id = auth.uid())
        or exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin')
      );
  exception when duplicate_object then null;
  end;
end$$;

-- driver_details
do $$
begin
  -- Drivers can insert own driver details
  begin
    create policy "Drivers can insert own driver details"
      on public.driver_details
      for insert
      with check (auth.uid() = user_id);
  exception when duplicate_object then null;
  end;

  -- Drivers can update own driver details
  begin
    create policy "Drivers can update own driver details"
      on public.driver_details
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  exception when duplicate_object then null;
  end;

  -- Drivers can view own driver details
  begin
    create policy "Drivers can view own driver details"
      on public.driver_details
      for select
      using (auth.uid() = user_id);
  exception when duplicate_object then null;
  end;

  -- Admins can view all driver details
  begin
    create policy "Admins can view all driver details"
      on public.driver_details
      for select
      using (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
  exception when duplicate_object then null;
  end;

  -- Admins can update any driver details
  begin
    create policy "Admins can update any driver details"
      on public.driver_details
      for update
      using (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'))
      with check (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
  exception when duplicate_object then null;
  end;
end$$;

-- 6) Updated_at triggers

-- admin_setup
drop trigger if exists trg_admin_setup_updated_at on public.admin_setup;
create trigger trg_admin_setup_updated_at
  before update on public.admin_setup
  for each row execute procedure public.set_updated_at();

-- profiles
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- pricing_settings
drop trigger if exists trg_pricing_settings_updated_at on public.pricing_settings;
create trigger trg_pricing_settings_updated_at
  before update on public.pricing_settings
  for each row execute procedure public.set_updated_at();

-- rides
drop trigger if exists trg_rides_updated_at on public.rides;
create trigger trg_rides_updated_at
  before update on public.rides
  for each row execute procedure public.set_updated_at();

-- driver_payout_requests
drop trigger if exists trg_driver_payout_requests_updated_at on public.driver_payout_requests;
create trigger trg_driver_payout_requests_updated_at
  before update on public.driver_payout_requests
  for each row execute procedure public.set_updated_at();

-- driver_details
drop trigger if exists trg_driver_details_updated_at on public.driver_details;
create trigger trg_driver_details_updated_at
  before update on public.driver_details
  for each row execute procedure public.set_updated_at();

-- 7) Realtime publication
do $$
begin
  begin
    alter publication supabase_realtime add table public.locations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.rides;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.driver_payout_requests;
  exception when duplicate_object then null;
  end;
end$$;

-- 8) Seed data (safe idempotent inserts)

-- 8.1) admin_setup seed for well-known admin id used by setup function
insert into public.admin_setup (admin_user_id, password_set)
values ('00000000-0000-0000-0000-000000000001', false)
on conflict (admin_user_id) do nothing;

-- 8.2) pricing_settings default row
insert into public.pricing_settings (
  singleton, price_per_km_active, price_per_km, fixed_price_active, fixed_price,
  service_fee_type, service_fee_value
) values (true, true, 2.5, false, null, 'fixed', 0)
on conflict (singleton) do nothing;

-- 9) Comments (optional but useful)
comment on table public.admin_setup is 'Stores initial admin configuration and setup status.';
comment on table public.profiles is 'User profiles (passenger, driver, admin).';
comment on table public.pricing_settings is 'Global pricing configuration (singleton).';
comment on table public.locations is 'Tracks real-time driver locations.';
comment on table public.rides is 'Ride requests and lifecycle history.';
comment on table public.driver_payout_requests is 'Driver payout requests management.';
comment on table public.ride_ratings is 'Ratings provided by passengers to drivers after completed rides.';
comment on table public.driver_details is 'Additional details for driver accounts.';

-- End of backup/setup script
