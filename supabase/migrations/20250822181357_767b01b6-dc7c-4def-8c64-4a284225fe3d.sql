-- =============================================================================
-- PROJETO RIDE-SHARING - BACKUP COMPLETO DO BANCO DE DADOS
-- =============================================================================
-- Este arquivo contém todo o schema necessário para recriar o banco de dados
-- do projeto de compartilhamento de caronas com rastreamento em tempo real.
-- Atualizado em: 2025-01-22
-- =============================================================================

-- =============================================================================
-- EXTENSÕES NECESSÁRIAS
-- =============================================================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Extensão para funções criptográficas
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- =============================================================================
-- TIPOS CUSTOMIZADOS
-- =============================================================================

-- Tipo para status de pagamento de motoristas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE public.payout_status AS ENUM ('pending', 'approved', 'rejected', 'paid');
  END IF;
END $$;

-- =============================================================================
-- FUNÇÕES UTILITÁRIAS
-- =============================================================================

-- Função para atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Função para criar perfil automaticamente quando usuário é criado
-- Atenção: usa schema auth (reservado do Supabase)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'handle_new_user' AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public
    AS $fn$
    BEGIN
      INSERT INTO public.profiles (id, full_name, user_type, is_active, created_at, updated_at)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
        COALESCE(NEW.raw_user_meta_data->>'user_type', 'passenger'),
        TRUE,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

-- Trigger para criação automática de perfil
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created' AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- =============================================================================
-- TABELAS PRINCIPAIS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: profiles (Perfis de usuários)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  user_type TEXT NOT NULL, -- 'passenger', 'driver', 'admin'
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND polname='Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND polname='Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND polname='Users can view all profiles') THEN
    CREATE POLICY "Users can view all profiles"
      ON public.profiles
      FOR SELECT
      USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND polname='Admins can update any profile') THEN
    CREATE POLICY "Admins can update any profile"
      ON public.profiles
      FOR UPDATE
      USING (EXISTS (
        SELECT 1 FROM public.profiles profiles_1
        WHERE profiles_1.id = auth.uid() AND profiles_1.user_type = 'admin'
      ));
  END IF;
END $$;

-- Trigger para updated_at em profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_set_updated_at') THEN
    CREATE TRIGGER profiles_set_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: admin_setup (Configuração inicial do admin)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_setup (
  admin_user_id UUID NOT NULL PRIMARY KEY,
  password_set BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para admin_setup
ALTER TABLE public.admin_setup ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para admin_setup
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Admins can manage admin_setup' AND tablename='admin_setup') THEN
    CREATE POLICY "Admins can manage admin_setup"
      ON public.admin_setup
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Admins can view admin_setup' AND tablename='admin_setup') THEN
    CREATE POLICY "Admins can view admin_setup"
      ON public.admin_setup
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- Trigger para updated_at em admin_setup
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'admin_setup_set_updated_at') THEN
    CREATE TRIGGER admin_setup_set_updated_at
      BEFORE UPDATE ON public.admin_setup
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: driver_details (Detalhes dos motoristas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_details (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL,
  vehicle_type TEXT DEFAULT 'car',
  vehicle_brand TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  vehicle_plate TEXT,
  driver_license TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para driver_details
ALTER TABLE public.driver_details ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para driver_details
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Drivers can insert their own details' AND tablename='driver_details') THEN
    CREATE POLICY "Drivers can insert their own details"
      ON public.driver_details
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Drivers can update their own details' AND tablename='driver_details') THEN
    CREATE POLICY "Drivers can update their own details"
      ON public.driver_details
      FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Drivers can view their own details' AND tablename='driver_details') THEN
    CREATE POLICY "Drivers can view their own details"
      ON public.driver_details
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Admins can view all driver details' AND tablename='driver_details') THEN
    CREATE POLICY "Admins can view all driver details"
      ON public.driver_details
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Users can view driver details for rides' AND tablename='driver_details') THEN
    CREATE POLICY "Users can view driver details for rides"
      ON public.driver_details
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.rides
        WHERE ((rides.passenger_id = auth.uid()) OR (rides.driver_id = auth.uid()))
          AND (rides.driver_id = driver_details.user_id)
      ));
  END IF;
END $$;

-- Trigger para updated_at em driver_details
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='driver_details_set_updated_at') THEN
    CREATE TRIGGER driver_details_set_updated_at
      BEFORE UPDATE ON public.driver_details
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: pricing_settings (Configurações de preços)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  price_per_km NUMERIC DEFAULT 2.50,
  fixed_price NUMERIC,
  price_per_km_active BOOLEAN DEFAULT TRUE,
  fixed_price_active BOOLEAN DEFAULT FALSE,
  service_fee_type TEXT DEFAULT 'fixed', -- 'fixed' ou 'percent'
  service_fee_value NUMERIC DEFAULT 0,
  singleton BOOLEAN DEFAULT TRUE,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para pricing_settings
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- Constraint para garantir apenas uma linha ativa
CREATE UNIQUE INDEX IF NOT EXISTS one_pricing_row ON public.pricing_settings (singleton) WHERE singleton;

-- Políticas RLS para pricing_settings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Admins can manage pricing settings' AND tablename='pricing_settings') THEN
    CREATE POLICY "Admins can manage pricing settings"
      ON public.pricing_settings
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Everyone can view pricing settings' AND tablename='pricing_settings') THEN
    CREATE POLICY "Everyone can view pricing settings"
      ON public.pricing_settings
      FOR SELECT
      USING (TRUE);
  END IF;
END $$;

-- Trigger para updated_at em pricing_settings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='pricing_settings_set_updated_at') THEN
    CREATE TRIGGER pricing_settings_set_updated_at
      BEFORE UPDATE ON public.pricing_settings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Dados iniciais para pricing_settings
INSERT INTO public.pricing_settings (price_per_km, fixed_price, price_per_km_active, fixed_price_active, service_fee_type, service_fee_value, singleton)
SELECT 2.50, NULL, TRUE, FALSE, 'fixed', 0, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_settings);

-- -----------------------------------------------------------------------------
-- Tabela: locations (Localizações em tempo real)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Índices para performance e upsert
CREATE UNIQUE INDEX IF NOT EXISTS locations_user_id_key ON public.locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_time ON public.locations(user_id, timestamp DESC);

-- Políticas RLS para locations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Users can manage their own location' AND tablename='locations') THEN
    CREATE POLICY "Users can manage their own location"
      ON public.locations
      FOR ALL
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Passengers can view driver location for active rides' AND tablename='locations') THEN
    CREATE POLICY "Passengers can view driver location for active rides"
      ON public.locations
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.rides
        WHERE rides.passenger_id = auth.uid()
          AND rides.driver_id = locations.user_id
          AND rides.status IN ('accepted', 'in_progress')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Users can view locations for active rides' AND tablename='locations') THEN
    CREATE POLICY "Users can view locations for active rides"
      ON public.locations
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.rides
        WHERE ((rides.passenger_id = auth.uid()) OR (rides.driver_id = auth.uid()))
          AND rides.status IN ('accepted', 'in_progress')
          AND ((rides.driver_id = locations.user_id) OR (rides.passenger_id = locations.user_id))
      ));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: rides (Corridas/viagens)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  passenger_id UUID NOT NULL,
  driver_id UUID,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  estimated_duration INTEGER,
  estimated_distance DOUBLE PRECISION,
  estimated_price NUMERIC,
  actual_price NUMERIC,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'
  driver_en_route BOOLEAN DEFAULT FALSE,
  en_route_started_at TIMESTAMPTZ,
  driver_to_pickup_distance_km DOUBLE PRECISION,
  driver_to_pickup_duration_min INTEGER,
  driver_arrived BOOLEAN DEFAULT FALSE,
  pickup_arrived_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  payment_method TEXT,
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL
);

-- RLS para rides
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON public.rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);

-- Políticas RLS para rides
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Admins can view all rides' AND tablename='rides') THEN
    CREATE POLICY "Admins can view all rides"
      ON public.rides
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Passengers can create rides' AND tablename='rides') THEN
    CREATE POLICY "Passengers can create rides"
      ON public.rides
      FOR INSERT
      WITH CHECK (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Passengers can update their rides' AND tablename='rides') THEN
    CREATE POLICY "Passengers can update their rides"
      ON public.rides
      FOR UPDATE
      USING (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Drivers can accept rides' AND tablename='rides') THEN
    CREATE POLICY "Drivers can accept rides"
      ON public.rides
      FOR UPDATE
      USING (
        (driver_id = auth.uid())
        OR (
          driver_id IS NULL
          AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'driver')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Users can view their own rides' AND tablename='rides') THEN
    CREATE POLICY "Users can view their own rides"
      ON public.rides
      FOR SELECT
      USING ((passenger_id = auth.uid()) OR (driver_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Drivers can view available rides' AND tablename='rides') THEN
    CREATE POLICY "Drivers can view available rides"
      ON public.rides
      FOR SELECT
      USING (
        driver_id IS NULL AND status = 'pending'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'driver')
      );
  END IF;
END $$;

-- Trigger para updated_at em rides
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='rides_set_updated_at') THEN
    CREATE TRIGGER rides_set_updated_at
      BEFORE UPDATE ON public.rides
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: ride_ratings (Avaliações de passageiros para motoristas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ride_ratings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ride_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  passenger_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para ride_ratings
ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ride_ratings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Passengers can create ratings' AND tablename='ride_ratings') THEN
    CREATE POLICY "Passengers can create ratings"
      ON public.ride_ratings
      FOR INSERT
      WITH CHECK (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Passengers can update their ratings' AND tablename='ride_ratings') THEN
    CREATE POLICY "Passengers can update their ratings"
      ON public.ride_ratings
      FOR UPDATE
      USING (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Users can view ratings for their rides' AND tablename='ride_ratings') THEN
    CREATE POLICY "Users can view ratings for their rides"
      ON public.ride_ratings
      FOR SELECT
      USING ((passenger_id = auth.uid()) OR (driver_id = auth.uid()));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: driver_passenger_ratings (Avaliações de motoristas para passageiros)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_passenger_ratings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ride_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  passenger_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para driver_passenger_ratings
ALTER TABLE public.driver_passenger_ratings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para driver_passenger_ratings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Drivers can create passenger ratings' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Drivers can create passenger ratings"
      ON public.driver_passenger_ratings
      FOR INSERT
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Drivers can update passenger ratings' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Drivers can update passenger ratings"
      ON public.driver_passenger_ratings
      FOR UPDATE
      USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Users can view driver ratings' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Users can view driver ratings"
      ON public.driver_passenger_ratings
      FOR SELECT
      USING ((driver_id = auth.uid()) OR (passenger_id = auth.uid()));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: driver_payout_requests (Solicitações de pagamento dos motoristas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_payout_requests (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  driver_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_details JSONB,
  status public.payout_status DEFAULT 'pending',
  notes TEXT,
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para driver_payout_requests
ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_driver ON public.driver_payout_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.driver_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created ON public.driver_payout_requests(created_at);

-- Políticas RLS para driver_payout_requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Drivers can create payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Drivers can create payout requests"
      ON public.driver_payout_requests
      FOR INSERT
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Drivers can view their own payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Drivers can view their own payout requests"
      ON public.driver_payout_requests
      FOR SELECT
      USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Admins can view all payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Admins can view all payout requests"
      ON public.driver_payout_requests
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Admins can update payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Admins can update payout requests"
      ON public.driver_payout_requests
      FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- Trigger para updated_at em driver_payout_requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='driver_payout_requests_set_updated_at') THEN
    CREATE TRIGGER driver_payout_requests_set_updated_at
      BEFORE UPDATE ON public.driver_payout_requests
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: chat_messages (Mensagens de chat entre motoristas e passageiros)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ride_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- RLS para chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_ride_created ON public.chat_messages(ride_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_unread ON public.chat_messages(receiver_id, read_at);

-- Políticas RLS para chat_messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Participants can insert messages during active rides' AND tablename='chat_messages') THEN
    CREATE POLICY "Participants can insert messages during active rides"
      ON public.chat_messages
      FOR INSERT
      WITH CHECK (
        (sender_id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.rides r
          WHERE r.id = chat_messages.ride_id
            AND r.status IN ('accepted', 'in_progress')
            AND (
              (chat_messages.sender_id = r.driver_id AND chat_messages.receiver_id = r.passenger_id)
              OR
              (chat_messages.sender_id = r.passenger_id AND chat_messages.receiver_id = r.driver_id)
            )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Participants can select chat messages for their rides' AND tablename='chat_messages') THEN
    CREATE POLICY "Participants can select chat messages for their rides"
      ON public.chat_messages
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.rides r
          WHERE r.id = chat_messages.ride_id
            AND (auth.uid() = r.driver_id OR auth.uid() = r.passenger_id)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='Receiver can update message read status' AND tablename='chat_messages') THEN
    CREATE POLICY "Receiver can update message read status"
      ON public.chat_messages
      FOR UPDATE
      USING (receiver_id = auth.uid())
      WITH CHECK (receiver_id = auth.uid());
  END IF;
END $$;

-- =============================================================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =============================================================================

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);

-- Índices para driver_details
CREATE INDEX IF NOT EXISTS idx_driver_details_user_id ON public.driver_details(user_id);

-- Índices para ride_ratings
CREATE INDEX IF NOT EXISTS idx_ride_ratings_ride_id ON public.ride_ratings(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_driver_id ON public.ride_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_passenger_id ON public.ride_ratings(passenger_id);

-- Índices para driver_passenger_ratings
CREATE INDEX IF NOT EXISTS idx_driver_passenger_ratings_ride_id ON public.driver_passenger_ratings(ride_id);
CREATE INDEX IF NOT EXISTS idx_driver_passenger_ratings_driver_id ON public.driver_passenger_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_passenger_ratings_passenger_id ON public.driver_passenger_ratings(passenger_id);

-- =============================================================================
-- CONFIGURAÇÕES DE TEMPO REAL (REALTIME)
-- =============================================================================

-- Configurar replica identity para payload completo em UPDATE
ALTER TABLE public.locations REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- =============================================================================
-- STORAGE (ARMAZENAMENTO DE ARQUIVOS)
-- =============================================================================

-- Criar bucket para avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Políticas para storage.objects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='Public can read avatars'
  ) THEN
    CREATE POLICY "Public can read avatars"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='Authenticated can upload avatars'
  ) THEN
    CREATE POLICY "Authenticated can upload avatars"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='Users can update their own avatar'
  ) THEN
    CREATE POLICY "Users can update their own avatar"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'avatars' AND owner = auth.uid()::TEXT)
      WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid()::TEXT);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='Users can delete their own avatar'
  ) THEN
    CREATE POLICY "Users can delete their own avatar"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'avatars' AND owner = auth.uid()::TEXT);
  END IF;
END $$;

-- =============================================================================
-- DADOS INICIAIS (SEED DATA)
-- =============================================================================

-- Inserir configuração inicial do admin (placeholder)
INSERT INTO public.admin_setup (admin_user_id, password_set)
VALUES ('00000000-0000-0000-0000-000000000000', FALSE)
ON CONFLICT (admin_user_id) DO NOTHING;