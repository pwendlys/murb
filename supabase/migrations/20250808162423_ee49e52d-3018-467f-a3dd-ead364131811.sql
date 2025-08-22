
-- 1) Criar tabela driver_details
create table if not exists public.driver_details (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null unique,
  driver_license text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_color text,
  vehicle_type text not null default 'car',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garantir RLS
alter table public.driver_details enable row level security;

-- Atualiza automaticamente updated_at
drop trigger if exists set_timestamp_on_driver_details on public.driver_details;
create trigger set_timestamp_on_driver_details
before update on public.driver_details
for each row execute function public.set_updated_at();

-- Políticas de acesso
-- Motorista pode ver os próprios dados
drop policy if exists "Drivers can view own driver details" on public.driver_details;
create policy "Drivers can view own driver details"
on public.driver_details
for select
using (auth.uid() = user_id);

-- Motorista pode criar seus dados
drop policy if exists "Drivers can insert own driver details" on public.driver_details;
create policy "Drivers can insert own driver details"
on public.driver_details
for insert
with check (auth.uid() = user_id);

-- Motorista pode atualizar seus dados
drop policy if exists "Drivers can update own driver details" on public.driver_details;
create policy "Drivers can update own driver details"
on public.driver_details
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Admin pode visualizar todos os dados
drop policy if exists "Admins can view all driver details" on public.driver_details;
create policy "Admins can view all driver details"
on public.driver_details
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.user_type = 'admin'
  )
);

-- Admin pode atualizar quaisquer dados
drop policy if exists "Admins can update any driver details" on public.driver_details;
create policy "Admins can update any driver details"
on public.driver_details
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.user_type = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.user_type = 'admin'
  )
);

-- 2) Ajustar a função handle_new_user para que motoristas entrem como inativos até aprovação
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
  );
  return new;
end;
$function$;
