
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

-- Tipo para status de taxas de motoristas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fee_status') THEN
    CREATE TYPE public.fee_status AS ENUM ('not_requested', 'pending', 'paid', 'canceled', 'expired');
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
        -- Mototaxistas precisam ser aprovados, então começam inativos
        CASE 
          WHEN COALESCE(NEW.raw_user_meta_data->>'user_type', 'passenger') = 'driver' THEN FALSE
          ELSE TRUE
        END,
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
-- Tabela: driver_balances (Saldos dos motoristas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_balances (
  driver_id UUID NOT NULL PRIMARY KEY,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  available NUMERIC NOT NULL DEFAULT 0,  -- disponível para reserva
  reserved NUMERIC NOT NULL DEFAULT 0,   -- reservado para taxas
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para driver_balances
ALTER TABLE public.driver_balances ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para driver_balances
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='balances_driver_select' AND tablename='driver_balances') THEN
    CREATE POLICY "balances_driver_select"
      ON public.driver_balances
      FOR SELECT
      USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='balances_admin_full' AND tablename='driver_balances') THEN
    CREATE POLICY "balances_admin_full"
      ON public.driver_balances
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin'));
  END IF;
END $$;

-- Trigger para updated_at em driver_balances
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='driver_balances_set_updated_at') THEN
    CREATE TRIGGER driver_balances_set_updated_at
      BEFORE UPDATE ON public.driver_balances
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: fee_payments (Pagamentos de taxas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status public.fee_status NOT NULL DEFAULT 'not_requested',
  initial_due_date TIMESTAMPTZ NOT NULL,  -- 2 dias após primeiro acesso
  payment_due_date TIMESTAMPTZ,  -- 2 dias após solicitação
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  canceled_reason TEXT,
  available_balance_before NUMERIC DEFAULT 0, -- Saldo antes da solicitação
  actual_fee_amount NUMERIC DEFAULT 0, -- Valor real da taxa
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para fee_payments
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fee_payments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='fee_driver_select' AND tablename='fee_payments') THEN
    CREATE POLICY "fee_driver_select"
      ON public.fee_payments
      FOR SELECT
      USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='fee_driver_insert' AND tablename='fee_payments') THEN
    CREATE POLICY "fee_driver_insert"
      ON public.fee_payments
      FOR INSERT
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='fee_driver_update_restrict' AND tablename='fee_payments') THEN
    CREATE POLICY "fee_driver_update_restrict"
      ON public.fee_payments
      FOR UPDATE
      USING (FALSE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='fee_admin_full' AND tablename='fee_payments') THEN
    CREATE POLICY "fee_admin_full"
      ON public.fee_payments
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin'));
  END IF;
END $$;

-- Trigger para updated_at em fee_payments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='fee_payments_set_updated_at') THEN
    CREATE TRIGGER fee_payments_set_updated_at
      BEFORE UPDATE ON public.fee_payments
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
ALTER TABLE public.driver_balances REPLICA IDENTITY FULL;
ALTER TABLE public.fee_payments REPLICA IDENTITY FULL;

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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='driver_balances'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_balances;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='fee_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fee_payments;
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
-- FUNÇÕES CRÍTICAS DO SISTEMA
-- =============================================================================

-- Função para calcular saldo do motorista
CREATE OR REPLACE FUNCTION public.calculate_driver_balance(p_driver_id uuid)
RETURNS public.driver_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance public.driver_balances;
  v_total_earnings numeric(14,2) := 0;
  v_paid_withdrawals numeric(14,2) := 0;
  v_paid_fees numeric(14,2) := 0;
  v_reserved numeric(14,2) := 0;
BEGIN
  -- Calcula total de ganhos das corridas completadas
  SELECT COALESCE(SUM(COALESCE(actual_price, estimated_price)), 0)
  INTO v_total_earnings
  FROM public.rides
  WHERE driver_id = p_driver_id AND status = 'completed';

  -- Calcula total de saques pagos
  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid_withdrawals
  FROM public.driver_payout_requests
  WHERE driver_id = p_driver_id AND status = 'paid';

  -- Calcula total de taxas pagas (NOVA DEDUÇÃO)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid_fees
  FROM public.fee_payments
  WHERE driver_id = p_driver_id AND status = 'paid';

  -- Calcula reservado para taxas pendentes/expiradas
  SELECT COALESCE(SUM(amount), 0)
  INTO v_reserved
  FROM public.fee_payments
  WHERE driver_id = p_driver_id AND status IN ('pending', 'expired');

  -- Insere ou atualiza saldo: disponível = ganhos - saques pagos - taxas pagas - reservado
  INSERT INTO public.driver_balances (driver_id, total_earnings, available, reserved)
  VALUES (p_driver_id, v_total_earnings, GREATEST(0, v_total_earnings - v_paid_withdrawals - v_paid_fees - v_reserved), v_reserved)
  ON CONFLICT (driver_id) DO UPDATE SET
    total_earnings = EXCLUDED.total_earnings,
    available = GREATEST(0, EXCLUDED.total_earnings - v_paid_withdrawals - v_paid_fees - EXCLUDED.reserved),
    reserved = EXCLUDED.reserved,
    updated_at = now()
  RETURNING * INTO v_balance;

  RETURN v_balance;
END
$$;

-- Função para calcular taxa de serviço
CREATE OR REPLACE FUNCTION public.calculate_service_fee(p_driver_id uuid, p_available_balance numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings record;
  v_fee_amount numeric(14,2) := 0;
BEGIN
  -- Buscar configurações de preço mais recentes
  SELECT service_fee_type, service_fee_value
  INTO v_settings
  FROM public.pricing_settings
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se não houver configurações, retorna 0
  IF NOT FOUND OR v_settings.service_fee_value IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calcular taxa baseada no tipo
  IF v_settings.service_fee_type = 'fixed' THEN
    v_fee_amount := v_settings.service_fee_value;
  ELSIF v_settings.service_fee_type = 'percent' THEN
    -- Calcular porcentagem sobre o saldo disponível
    v_fee_amount := p_available_balance * (v_settings.service_fee_value / 100);
  END IF;
  
  -- Garantir que não seja negativo e não exceda o saldo disponível
  RETURN GREATEST(0, LEAST(v_fee_amount, p_available_balance));
END
$$;

-- Função para solicitar pagamento de taxa
CREATE OR REPLACE FUNCTION public.request_fee_payment()
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver_id uuid := auth.uid();
  v_balance public.driver_balances;
  v_payment public.fee_payments;
  v_profile_created_at timestamptz;
  v_now timestamptz := now();
  v_fee_amount numeric(14,2);
  v_initial_due_date timestamptz;
  v_available_balance numeric(14,2);
BEGIN
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verifica se é um motorista
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_driver_id AND user_type = 'driver') THEN
    RAISE EXCEPTION 'not_a_driver';
  END IF;

  -- Busca data de criação do perfil
  SELECT created_at INTO v_profile_created_at
  FROM public.profiles
  WHERE id = v_driver_id;

  v_initial_due_date := v_profile_created_at + interval '2 days';

  -- Verifica se ainda está no prazo para solicitar (2 dias após cadastro)
  IF v_now > v_initial_due_date THEN
    RAISE EXCEPTION 'initial_deadline_expired';
  END IF;

  -- Calcula e obtém saldo atual
  SELECT * INTO v_balance FROM public.calculate_driver_balance(v_driver_id);
  v_available_balance := v_balance.available;

  -- Verifica se tem saldo disponível
  IF v_available_balance <= 0 THEN
    RAISE EXCEPTION 'no_available_funds';
  END IF;

  -- Calcula taxa baseada no saldo disponível
  v_fee_amount := public.calculate_service_fee(v_driver_id, v_available_balance);
  
  -- Verifica se a taxa calculada é maior que zero
  IF v_fee_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_fee_amount';
  END IF;

  -- NOVA LÓGICA: Zerar todo o saldo disponível
  -- Todo o saldo disponível vai para reservado, mas só a taxa é paga
  UPDATE public.driver_balances
  SET available = 0,
      reserved = reserved + v_available_balance
  WHERE driver_id = v_driver_id;

  -- Cria fee_payment com informações detalhadas
  INSERT INTO public.fee_payments (
    driver_id, 
    amount, 
    status, 
    initial_due_date, 
    payment_due_date,
    available_balance_before,
    actual_fee_amount
  )
  VALUES (
    v_driver_id, 
    v_available_balance,  -- O valor total reservado é o saldo disponível
    'pending', 
    v_initial_due_date, 
    v_now + interval '2 days',
    v_available_balance,  -- Saldo antes da solicitação
    v_fee_amount          -- Valor real da taxa
  )
  RETURNING * INTO v_payment;

  RETURN v_payment;
END
$$;

-- Função para marcar taxa como paga
CREATE OR REPLACE FUNCTION public.mark_fee_paid(p_fee_id uuid)
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment public.fee_payments;
BEGIN
  -- Verifica se é admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_payment FROM public.fee_payments WHERE id = p_fee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'fee_not_found'; END IF;
  
  IF v_payment.status NOT IN ('pending', 'expired') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Liberar apenas o que sobrou após deduzir a taxa
  -- amount = saldo total reservado, actual_fee_amount = taxa paga
  UPDATE public.driver_balances
  SET reserved = GREATEST(reserved - v_payment.amount, 0),
      available = available + GREATEST(v_payment.amount - v_payment.actual_fee_amount, 0)
  WHERE driver_id = v_payment.driver_id;

  UPDATE public.fee_payments
  SET status = 'paid',
      paid_at = now()
  WHERE id = p_fee_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END
$$;

-- Função para cancelar taxa
CREATE OR REPLACE FUNCTION public.cancel_fee(p_fee_id uuid, p_reason text)
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment public.fee_payments;
BEGIN
  -- Verifica se é admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_payment FROM public.fee_payments WHERE id = p_fee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'fee_not_found'; END IF;
  
  IF v_payment.status NOT IN ('pending', 'expired') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Reverte a reserva para available
  UPDATE public.driver_balances
  SET reserved  = GREATEST(reserved - v_payment.amount, 0),
      available = available + v_payment.amount
  WHERE driver_id = v_payment.driver_id;

  UPDATE public.fee_payments
  SET status          = 'canceled',
      canceled_at     = now(),
      canceled_reason = p_reason
  WHERE id = p_fee_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END
$$;

-- Função trigger para atualizar saldo quando status de taxa muda
CREATE OR REPLACE FUNCTION public.update_driver_balance_on_fee_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Recalcular saldo quando status da taxa mudar para 'paid' ou 'canceled'
  IF (NEW.status != OLD.status) AND (NEW.status IN ('paid', 'canceled')) THEN
    PERFORM public.calculate_driver_balance(NEW.driver_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Função trigger para atualizar saldo quando corrida é completada
CREATE OR REPLACE FUNCTION public.update_driver_balance_on_ride_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se mudou para 'completed', atualiza o saldo do motorista
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.driver_id IS NOT NULL THEN
    PERFORM public.calculate_driver_balance(NEW.driver_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Função trigger para definir preço real automaticamente
CREATE OR REPLACE FUNCTION public.set_actual_price_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se a corrida está sendo marcada como completed e não tem actual_price definido
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.actual_price IS NULL THEN
    NEW.actual_price = NEW.estimated_price;
  END IF;
  RETURN NEW;
END;
$$;

-- Função trigger alternativa para atualização de saldo após completar corrida
CREATE OR REPLACE FUNCTION public.update_driver_balance_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se a corrida foi marcada como completed e tem driver_id
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.driver_id IS NOT NULL THEN
    -- Chama a função para recalcular saldos
    PERFORM public.calculate_driver_balance(NEW.driver_id);
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TRIGGERS DO SISTEMA
-- =============================================================================

-- Trigger para definir preço real antes de completar corrida
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_actual_price_before_completion') THEN
    CREATE TRIGGER set_actual_price_before_completion
      BEFORE UPDATE ON public.rides
      FOR EACH ROW EXECUTE FUNCTION public.set_actual_price_on_completion();
  END IF;
END $$;

-- Trigger para atualizar saldo após completar corrida
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_balance_after_completion') THEN
    CREATE TRIGGER update_balance_after_completion
      AFTER UPDATE ON public.rides
      FOR EACH ROW EXECUTE FUNCTION public.update_driver_balance_on_completion();
  END IF;
END $$;

-- Trigger para atualizar saldo quando status de fee muda
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_balance_on_fee_change') THEN
    CREATE TRIGGER update_balance_on_fee_change
      AFTER UPDATE ON public.fee_payments
      FOR EACH ROW EXECUTE FUNCTION public.update_driver_balance_on_fee_status_change();
  END IF;
END $$;

-- =============================================================================
-- DADOS INICIAIS (SEED DATA)
-- =============================================================================

-- Inserir configuração inicial do admin (placeholder)
INSERT INTO public.admin_setup (admin_user_id, password_set)
VALUES ('00000000-0000-0000-0000-000000000000', FALSE)
ON CONFLICT (admin_user_id) DO NOTHING;

-- =============================================================================
-- VERIFICAÇÃO E COMENTÁRIOS FINAIS
-- =============================================================================

-- Comentários explicativos para as principais tabelas
COMMENT ON TABLE public.profiles IS 'Perfis de usuários do sistema (passageiros, motoristas e administradores)';
COMMENT ON TABLE public.driver_details IS 'Detalhes específicos dos motoristas (veículo, licença, etc.)';
COMMENT ON TABLE public.locations IS 'Localizações em tempo real dos usuários para rastreamento';
COMMENT ON TABLE public.rides IS 'Registro de todas as corridas solicitadas e realizadas';
COMMENT ON TABLE public.chat_messages IS 'Mensagens de chat entre motoristas e passageiros durante corridas ativas';
COMMENT ON TABLE public.pricing_settings IS 'Configurações globais de preços e taxas do sistema';
COMMENT ON TABLE public.driver_payout_requests IS 'Solicitações de pagamento dos motoristas';
COMMENT ON TABLE public.ride_ratings IS 'Avaliações dos passageiros sobre os motoristas';
COMMENT ON TABLE public.driver_passenger_ratings IS 'Avaliações dos motoristas sobre os passageiros';
COMMENT ON TABLE public.admin_setup IS 'Configuração inicial do sistema para administradores';
COMMENT ON TABLE public.driver_balances IS 'Sistema de saldos e controle financeiro dos motoristas';
COMMENT ON TABLE public.fee_payments IS 'Sistema de pagamento de taxas de serviço dos motoristas';

-- Verificação de integridade
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Contar tabelas criadas (agora são 12 tabelas)
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'profiles', 'admin_setup', 'driver_details', 'pricing_settings', 
        'locations', 'rides', 'ride_ratings', 'driver_passenger_ratings', 
        'driver_payout_requests', 'chat_messages', 'driver_balances', 'fee_payments'
    );
    
    -- Contar funções criadas (agora são 11 funções)
    SELECT COUNT(*) INTO function_count 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN (
        'set_updated_at', 'handle_new_user', 'calculate_driver_balance', 
        'calculate_service_fee', 'request_fee_payment', 'mark_fee_paid', 
        'cancel_fee', 'update_driver_balance_on_fee_status_change',
        'update_driver_balance_on_ride_completion', 'set_actual_price_on_completion',
        'update_driver_balance_on_completion'
    );
    
    -- Contar triggers criados
    SELECT COUNT(*) INTO trigger_count 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
    
    -- Relatório de verificação
    RAISE NOTICE '=== VERIFICAÇÃO DE MIGRAÇÃO COMPLETA ===';
    RAISE NOTICE 'Tabelas criadas: % de 12 esperadas', table_count;
    RAISE NOTICE 'Funções criadas: % de 11 esperadas', function_count;
    RAISE NOTICE 'Triggers criados: % triggers', trigger_count;
    
    IF table_count = 12 AND function_count = 11 THEN
        RAISE NOTICE '✅ Migração executada com SUCESSO COMPLETO!';
        RAISE NOTICE '✅ Sistema de fees e saldos configurado!';
        RAISE NOTICE '✅ Todas as funções críticas implementadas!';
    ELSE
        RAISE WARNING '⚠️  Verifique se todas as tabelas e funções foram criadas corretamente';
        RAISE NOTICE 'Esperado: 12 tabelas, % encontradas', table_count;
        RAISE NOTICE 'Esperado: 11 funções, % encontradas', function_count;
    END IF;
END $$;

-- =============================================================================
-- FINALIZAÇÃO
-- =============================================================================

-- Este backup contém:
-- ✅ 12 tabelas principais do sistema (incluindo driver_balances e fee_payments)
-- ✅ 2 tipos customizados (payout_status e fee_status)
-- ✅ 11 funções críticas do sistema incluindo:
--   • Funções utilitárias (set_updated_at, handle_new_user)
--   • Sistema de saldos (calculate_driver_balance, calculate_service_fee)
--   • Sistema de fees (request_fee_payment, mark_fee_paid, cancel_fee)  
--   • Triggers functions (update_driver_balance_*, set_actual_price_*)
-- ✅ Todas as políticas RLS necessárias para segurança
-- ✅ Triggers para updated_at automático e atualizações de saldo
-- ✅ Índices para otimização de performance
-- ✅ Configurações de tempo real (realtime) para todas as tabelas críticas
-- ✅ Bucket de storage para avatars com políticas apropriadas
-- ✅ Sistema completo de fees e saldos operacional
-- ✅ Dados iniciais (seed data)
-- ✅ Verificação de integridade completa
-- ✅ Comentários e documentação detalhada

SELECT 'Backup COMPLETO do banco de dados criado com sucesso! Sistema de fees implementado! 🚀' AS status;
