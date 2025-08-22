
-- 1) Tabela de detalhes do motorista
create table if not exists public.driver_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  driver_license text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_color text,
  vehicle_type text check (vehicle_type in ('car','moto')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Relacionamento com profiles (não referenciamos auth.users diretamente)
alter table public.driver_details
  add constraint if not exists driver_details_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- RLS
alter table public.driver_details enable row level security;

-- SELECT: motorista vê o próprio, admin vê todos
drop policy if exists "Drivers can view own details or admins can view all" on public.driver_details;
create policy "Drivers can view own details or admins can view all"
  on public.driver_details
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.user_type = 'admin'
    )
  );

-- INSERT: apenas o próprio motorista
drop policy if exists "Drivers can create own details" on public.driver_details;
create policy "Drivers can create own details"
  on public.driver_details
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.user_type = 'driver'
    )
  );

-- UPDATE: motorista atualiza o próprio, admin pode atualizar qualquer um
drop policy if exists "Drivers or admins can update details" on public.driver_details;
create policy "Drivers or admins can update details"
  on public.driver_details
  for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.user_type = 'admin'
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.user_type = 'admin'
    )
  );

-- Trigger updated_at para driver_details
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_driver_details_updated_at') then
    create trigger set_driver_details_updated_at
    before update on public.driver_details
    for each row execute procedure public.set_updated_at();
  end if;
end $$;

-- 2) Atualizar função de criação de perfil para tratar motoristas e dados de veículo
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_full_name text;
  v_user_type text;
  v_phone text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  v_user_type := coalesce(new.raw_user_meta_data->>'user_type', 'passenger');
  v_phone := new.raw_user_meta_data->>'phone';

  -- Cria o profile; motoristas começam inativos (aguardando aprovação)
  insert into public.profiles (id, full_name, user_type, phone, is_active)
  values (
    new.id,
    v_full_name,
    v_user_type,
    v_phone,
    case when v_user_type = 'driver' then false else true end
  );

  -- Se for motorista, cria/guarda os dados do veículo sem depender de sessão
  if v_user_type = 'driver' then
    insert into public.driver_details (
      user_id, driver_license, vehicle_brand, vehicle_model, vehicle_plate, vehicle_color, vehicle_type
    ) values (
      new.id,
      new.raw_user_meta_data->>'driver_license',
      new.raw_user_meta_data->>'vehicle_brand',
      new.raw_user_meta_data->>'vehicle_model',
      new.raw_user_meta_data->>'vehicle_plate',
      new.raw_user_meta_data->>'vehicle_color',
      coalesce(new.raw_user_meta_data->>'vehicle_type', 'car')
    );
  end if;

  return new;
end;
$function$;

-- 3) Garantir trigger de criação de perfil ao inserir em auth.users
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute procedure public.handle_new_user();
  end if;
end $$;

-- 4) Garantir trigger updated_at para profiles (caso não exista)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_profiles_updated_at') then
    create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute procedure public.set_updated_at();
  end if;
end $$;
