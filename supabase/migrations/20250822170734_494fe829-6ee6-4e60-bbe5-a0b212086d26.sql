
-- =========================
-- Extensões necessárias
-- =========================
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- =========================
-- Tipos
-- =========================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'payout_status') then
    create type public.payout_status as enum ('pending','approved','rejected','paid');
  end if;
end $$;

-- =========================
-- Funções utilitárias
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new is distinct from old then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

-- Opcional: criação automática de perfil ao criar usuário (mantenho para compatibilidade)
-- Atenção: usa schema auth (reservado), então envolvido em bloco seguro e só cria se não existir
do $$ begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where p.proname = 'handle_new_user' and n.nspname = 'public'
  ) then
    create function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer set search_path = public
    as $fn$
    begin
      insert into public.profiles (id, full_name, user_type, is_active, created_at, updated_at)
      values (new.id, coalesce(new.raw_user_meta_data->>'full_name','Usuário'), coalesce(new.raw_user_meta_data->>'user_type','passenger'), true, now(), now())
      on conflict (id) do nothing;
      return new;
    end;
    $fn$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute procedure public.handle_new_user();
  end if;
end $$;

-- =========================
-- Tabela: profiles
-- =========================
create table if not exists public.profiles (
  id uuid not null,
  full_name text not null,
  phone text,
  user_type text not null,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

alter table public.profiles enable row level security;

-- Políticas (mantidas exatamente como no projeto)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and polname='Users can insert their own profile') then
    create policy "Users can insert their own profile"
      on public.profiles
      for insert
      with check (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and polname='Users can update their own profile') then
    create policy "Users can update their own profile"
      on public.profiles
      for update
      using (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and polname='Users can view all profiles') then
    create policy "Users can view all profiles"
      on public.profiles
      for select
      using (true);
  end if;
end $$;

-- Nota: política de admin refletindo a já existente (usa self-reference conforme atual)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and polname='Admins can update any profile') then
    create policy "Admins can update any profile"
      on public.profiles
      for update
      using (exists (
        select 1 from public.profiles profiles_1
        where profiles_1.id = auth.uid() and profiles_1.user_type = 'admin'
      ));
  end if;
end $$;

-- Trigger updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_set_updated_at') then
    create trigger profiles_set_updated_at
      before update on public.profiles
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- =========================
-- Tabela: admin_setup
-- =========================
create table if not exists public.admin_setup (
  admin_user_id uuid not null,
  password_set boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (admin_user_id)
);

alter table public.admin_setup enable row level security;

-- Políticas
do $$ begin
  if not exists (select 1 from pg_policies where polname='Admins can manage admin_setup' and tablename='admin_setup') then
    create policy "Admins can manage admin_setup"
      on public.admin_setup
      for all
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Admins can view admin_setup' and tablename='admin_setup') then
    create policy "Admins can view admin_setup"
      on public.admin_setup
      for select
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin'));
  end if;
end $$;

-- Trigger updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'admin_setup_set_updated_at') then
    create trigger admin_setup_set_updated_at
      before update on public.admin_setup
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- =========================
-- Tabela: driver_details
-- =========================
create table if not exists public.driver_details (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null,
  vehicle_type text default 'car',
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text,
  driver_license text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.driver_details enable row level security;

-- Políticas
do $$ begin
  if not exists (select 1 from pg_policies where polname='Drivers can insert their own details' and tablename='driver_details') then
    create policy "Drivers can insert their own details"
      on public.driver_details
      for insert
      with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Drivers can update their own details' and tablename='driver_details') then
    create policy "Drivers can update their own details"
      on public.driver_details
      for update
      using (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Drivers can view their own details' and tablename='driver_details') then
    create policy "Drivers can view their own details"
      on public.driver_details
      for select
      using (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Admins can view all driver details' and tablename='driver_details') then
    create policy "Admins can view all driver details"
      on public.driver_details
      for select
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Users can view driver details for rides' and tablename='driver_details') then
    create policy "Users can view driver details for rides"
      on public.driver_details
      for select
      using (exists (
        select 1 from public.rides
        where ((rides.passenger_id = auth.uid()) or (rides.driver_id = auth.uid()))
          and (rides.driver_id = driver_details.user_id)
      ));
  end if;
end $$;

-- Trigger updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='driver_details_set_updated_at') then
    create trigger driver_details_set_updated_at
      before update on public.driver_details
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- =========================
-- Tabela: pricing_settings
-- =========================
create table if not exists public.pricing_settings (
  id uuid primary key default extensions.uuid_generate_v4(),
  price_per_km numeric default 2.50,
  fixed_price numeric,
  price_per_km_active boolean default true,
  fixed_price_active boolean default false,
  service_fee_type text default 'fixed',
  service_fee_value numeric default 0,
  singleton boolean default true,
  updated_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.pricing_settings enable row level security;

-- Única linha ativa (opcional, como no backup anterior)
create unique index if not exists one_pricing_row on public.pricing_settings (singleton) where singleton;

-- Políticas
do $$ begin
  if not exists (select 1 from pg_policies where polname='Admins can manage pricing settings' and tablename='pricing_settings') then
    create policy "Admins can manage pricing settings"
      on public.pricing_settings
      for all
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Everyone can view pricing settings' and tablename='pricing_settings') then
    create policy "Everyone can view pricing settings"
      on public.pricing_settings
      for select
      using (true);
  end if;
end $$;

-- Trigger updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='pricing_settings_set_updated_at') then
    create trigger pricing_settings_set_updated_at
      before update on public.pricing_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Seed (somente se não houver nenhum registro)
insert into public.pricing_settings (price_per_km, fixed_price, price_per_km_active, fixed_price_active, service_fee_type, service_fee_value, singleton)
select 2.50, null, true, false, 'fixed', 0, true
where not exists (select 1 from public.pricing_settings);

-- =========================
-- Tabela: locations
-- =========================
create table if not exists public.locations (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  speed double precision,
  timestamp timestamptz default now()
);

alter table public.locations enable row level security;

-- Índices e unicidade para upsert por user_id
create unique index if not exists locations_user_id_key on public.locations(user_id);
create index if not exists idx_locations_user_time on public.locations(user_id, timestamp desc);

-- Políticas
do $$ begin
  if not exists (select 1 from pg_policies where polname='Users can manage their own location' and tablename='locations') then
    create policy "Users can manage their own location"
      on public.locations
      for all
      using (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Passengers can view driver location for active rides' and tablename='locations') then
    create policy "Passengers can view driver location for active rides"
      on public.locations
      for select
      using (exists (
        select 1 from public.rides
        where rides.passenger_id = auth.uid()
          and rides.driver_id = locations.user_id
          and rides.status in ('accepted','in_progress')
      ));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Users can view locations for active rides' and tablename='locations') then
    create policy "Users can view locations for active rides"
      on public.locations
      for select
      using (exists (
        select 1 from public.rides
        where ((rides.passenger_id = auth.uid()) or (rides.driver_id = auth.uid()))
          and rides.status in ('accepted','in_progress')
          and ((rides.driver_id = locations.user_id) or (rides.passenger_id = locations.user_id))
      ));
  end if;
end $$;

-- =========================
-- Tabela: rides
-- =========================
create table if not exists public.rides (
  id uuid primary key default extensions.uuid_generate_v4(),
  passenger_id uuid not null,
  driver_id uuid,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  estimated_duration integer,
  estimated_distance double precision,
  estimated_price numeric,
  actual_price numeric,
  status text default 'pending',
  driver_en_route boolean default false,
  en_route_started_at timestamptz,
  driver_to_pickup_distance_km double precision,
  driver_to_pickup_duration_min integer,
  driver_arrived boolean default false,
  pickup_arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  payment_method text,
  origin_address text not null,
  destination_address text not null
);

alter table public.rides enable row level security;

create index if not exists idx_rides_passenger on public.rides(passenger_id);
create index if not exists idx_rides_driver on public.rides(driver_id);
create index if not exists idx_rides_status on public.rides(status);

-- Políticas
do $$ begin
  if not exists (select 1 from pg_policies where polname='Admins can view all rides' and tablename='rides') then
    create policy "Admins can view all rides"
      on public.rides
      for select
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Passengers can create rides' and tablename='rides') then
    create policy "Passengers can create rides"
      on public.rides
      for insert
      with check (passenger_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Passengers can update their rides' and tablename='rides') then
    create policy "Passengers can update their rides"
      on public.rides
      for update
      using (passenger_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Drivers can accept rides' and tablename='rides') then
    create policy "Drivers can accept rides"
      on public.rides
      for update
      using (
        (driver_id = auth.uid())
        or (
          driver_id is null
          and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'driver')
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Users can view their own rides' and tablename='rides') then
    create policy "Users can view their own rides"
      on public.rides
      for select
      using ((passenger_id = auth.uid()) or (driver_id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Drivers can view available rides' and tablename='rides') then
    create policy "Drivers can view available rides"
      on public.rides
      for select
      using (
        driver_id is null and status = 'pending'
        and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'driver')
      );
  end if;
end $$;

-- Trigger updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='rides_set_updated_at') then
    create trigger rides_set_updated_at
      before update on public.rides
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- =========================
-- Tabela: ride_ratings
-- =========================
create table if not exists public.ride_ratings (
  id uuid primary key default extensions.uuid_generate_v4(),
  ride_id uuid not null,
  driver_id uuid not null,
  passenger_id uuid not null,
  rating integer not null,
  comment text,
  created_at timestamptz default now()
);

alter table public.ride_ratings enable row level security;

-- Políticas
do $$ begin
  if not exists (select 1 from pg_policies where polname='Passengers can create ratings' and tablename='ride_ratings') then
    create policy "Passengers can create ratings"
      on public.ride_ratings
      for insert
      with check (passenger_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Passengers can update their ratings' and tablename='ride_ratings') then
    create policy "Passengers can update their ratings"
      on public.ride_ratings
      for update
      using (passenger_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Users can view ratings for their rides' and tablename='ride_ratings') then
    create policy "Users can view ratings for their rides"
      on public.ride_ratings
      for select
      using ((passenger_id = auth.uid()) or (driver_id = auth.uid()));
  end if;
end $$;

-- =========================
-- Tabela: driver_passenger_ratings
-- =========================
create table if not exists public.driver_passenger_ratings (
  id uuid primary key default extensions.uuid_generate_v4(),
  ride_id uuid not null,
  driver_id uuid not null,
  passenger_id uuid not null,
  rating integer not null,
  comment text,
  created_at timestamptz default now()
);

alter table public.driver_passenger_ratings enable row level security;

-- Políticas
do $$ begin
  if not exists (select 1 from pg_policies where polname='Drivers can create passenger ratings' and tablename='driver_passenger_ratings') then
    create policy "Drivers can create passenger ratings"
      on public.driver_passenger_ratings
      for insert
      with check (driver_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Drivers can update passenger ratings' and tablename='driver_passenger_ratings') then
    create policy "Drivers can update passenger ratings"
      on public.driver_passenger_ratings
      for update
      using (driver_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Users can view driver ratings' and tablename='driver_passenger_ratings') then
    create policy "Users can view driver ratings"
      on public.driver_passenger_ratings
      for select
      using ((driver_id = auth.uid()) or (passenger_id = auth.uid()));
  end if;
end $$;

-- =========================
-- Tabela: driver_payout_requests
-- =========================
create table if not exists public.driver_payout_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  driver_id uuid not null,
  amount numeric not null,
  payment_method text not null,
  payment_details jsonb,
  status public.payout_status default 'pending',
  notes text,
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.driver_payout_requests enable row level security;

create index if not exists idx_payout_requests_driver on public.driver_payout_requests(driver_id);
create index if not exists idx_payout_requests_status on public.driver_payout_requests(status);
create index if not exists idx_payout_requests_created on public.driver_payout_requests(created_at);

-- Políticas
do $$ begin
  if not exists (select 1 from pg_policies where polname='Drivers can create payout requests' and tablename='driver_payout_requests') then
    create policy "Drivers can create payout requests"
      on public.driver_payout_requests
      for insert
      with check (driver_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Drivers can view their own payout requests' and tablename='driver_payout_requests') then
    create policy "Drivers can view their own payout requests"
      on public.driver_payout_requests
      for select
      using (driver_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Admins can view all payout requests' and tablename='driver_payout_requests') then
    create policy "Admins can view all payout requests"
      on public.driver_payout_requests
      for select
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Admins can update payout requests' and tablename='driver_payout_requests') then
    create policy "Admins can update payout requests"
      on public.driver_payout_requests
      for update
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin'));
  end if;
end $$;

-- Trigger updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='driver_payout_requests_set_updated_at') then
    create trigger driver_payout_requests_set_updated_at
      before update on public.driver_payout_requests
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- =========================
-- Tabela: chat_messages
-- =========================
create table if not exists public.chat_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  ride_id uuid not null,
  sender_id uuid not null,
  receiver_id uuid not null,
  text text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);

alter table public.chat_messages enable row level security;

create index if not exists idx_chat_messages_ride_created on public.chat_messages(ride_id, created_at);
create index if not exists idx_chat_messages_receiver_unread on public.chat_messages(receiver_id, read_at);

-- Políticas (exatamente como no projeto)
do $$ begin
  if not exists (select 1 from pg_policies where polname='Participants can insert messages during active rides' and tablename='chat_messages') then
    create policy "Participants can insert messages during active rides"
      on public.chat_messages
      for insert
      with check (
        (sender_id = auth.uid())
        and exists (
          select 1 from public.rides r
          where r.id = chat_messages.ride_id
            and r.status in ('accepted','in_progress')
            and (
              (chat_messages.sender_id = r.driver_id and chat_messages.receiver_id = r.passenger_id)
              or
              (chat_messages.sender_id = r.passenger_id and chat_messages.receiver_id = r.driver_id)
            )
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Participants can select chat messages for their rides' and tablename='chat_messages') then
    create policy "Participants can select chat messages for their rides"
      on public.chat_messages
      for select
      using (
        exists (
          select 1 from public.rides r
          where r.id = chat_messages.ride_id
            and (auth.uid() = r.driver_id or auth.uid() = r.passenger_id)
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='Receiver can update message read status' and tablename='chat_messages') then
    create policy "Receiver can update message read status"
      on public.chat_messages
      for update
      using (receiver_id = auth.uid())
      with check (receiver_id = auth.uid());
  end if;
end $$;

-- =========================
-- Realtime (publications + replica identity)
-- =========================
-- replica identity full garante payload completo em UPDATE
alter table public.locations replica identity full;
alter table public.rides replica identity full;
alter table public.chat_messages replica identity full;

-- Adicionar tabelas à publicação supabase_realtime (idempotente)
do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='locations'
  ) then
    alter publication supabase_realtime add table public.locations;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rides'
  ) then
    alter publication supabase_realtime add table public.rides;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- =========================
-- Storage: bucket avatars + políticas
-- =========================
-- Criar bucket público "avatars" se não existir
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Políticas na storage.objects
-- Permitir leitura pública de arquivos no bucket avatars
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and polname='Public can read avatars'
  ) then
    create policy "Public can read avatars"
      on storage.objects
      for select
      using (bucket_id = 'avatars');
  end if;
end $$;

-- Permitir upload por usuários autenticados
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and polname='Authenticated can upload avatars'
  ) then
    create policy "Authenticated can upload avatars"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'avatars');
  end if;
end $$;

-- Permitir atualizar/remover apenas o próprio arquivo
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and polname='Users can update their own avatar'
  ) then
    create policy "Users can update their own avatar"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'avatars' and owner = auth.uid()::text)
      with check (bucket_id = 'avatars' and owner = auth.uid()::text);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and polname='Users can delete their own avatar'
  ) then
    create policy "Users can delete their own avatar"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'avatars' and owner = auth.uid()::text);
  end if;
end $$;

-- =========================
-- Índices adicionais úteis
-- =========================
create index if not exists idx_profiles_active on public.profiles(is_active);
create index if not exists idx_profiles_user_type on public.profiles(user_type);
