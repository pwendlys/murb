
-- 1) Tabela de mensagens do chat
create table if not exists public.chat_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  constraint chat_messages_text_length check (char_length(text) > 0 and char_length(text) <= 1000)
);

-- 2) Habilitar RLS
alter table public.chat_messages enable row level security;

-- 3) Políticas RLS

-- Participantes (motorista ou passageiro) podem visualizar mensagens da própria corrida
create policy "Participants can select chat messages for their rides"
on public.chat_messages
for select
using (
  exists (
    select 1
    from public.rides r
    where r.id = ride_id
      and (auth.uid() = r.driver_id or auth.uid() = r.passenger_id)
  )
);

-- Apenas o participante que envia pode inserir mensagens, e somente se a corrida estiver aceita/em andamento
create policy "Participants can insert messages during active rides"
on public.chat_messages
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.rides r
    where r.id = ride_id
      and r.status in ('accepted', 'in_progress')
      and (
        (sender_id = r.driver_id and receiver_id = r.passenger_id)
        or
        (sender_id = r.passenger_id and receiver_id = r.driver_id)
      )
  )
);

-- Apenas o destinatário pode atualizar (para marcar como lida)
create policy "Receiver can update message read status"
on public.chat_messages
for update
using (receiver_id = auth.uid())
with check (receiver_id = auth.uid());

-- 4) Triggers de segurança e conveniência

-- 4.1) delivered_at automático no INSERT
create or replace function public.set_delivered_timestamp()
returns trigger
language plpgsql
as $$
begin
  if new.delivered_at is null then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chat_messages_set_delivered on public.chat_messages;
create trigger trg_chat_messages_set_delivered
before insert on public.chat_messages
for each row
execute function public.set_delivered_timestamp();

-- 4.2) Impedir alterações de conteúdo/participantes nas atualizações (permitir só metadados como read_at)
create or replace function public.prevent_message_mutation()
returns trigger
language plpgsql
as $$
begin
  if (new.text is distinct from old.text)
     or (new.ride_id is distinct from old.ride_id)
     or (new.sender_id is distinct from old.sender_id)
     or (new.receiver_id is distinct from old.receiver_id)
  then
    raise exception 'Only metadata fields can be updated on chat_messages';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chat_messages_prevent_mutation on public.chat_messages;
create trigger trg_chat_messages_prevent_mutation
before update on public.chat_messages
for each row
execute function public.prevent_message_mutation();

-- 5) Índices para performance e contagem de não lidas
create index if not exists chat_messages_ride_created_idx on public.chat_messages (ride_id, created_at);
create index if not exists chat_messages_unread_idx on public.chat_messages (ride_id, receiver_id) where read_at is null;

-- 6) Realtime: garantir publicação
alter table public.chat_messages replica identity full;
alter publication supabase_realtime add table public.chat_messages;
