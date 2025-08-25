-- =============================================================================
-- PROJETO RIDE-SHARING - BACKUP COMPLETO DO BANCO DE DADOS (CORRIGIDO)
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

-- Políticas RLS para profiles (corrigido policyname)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can view all profiles') THEN
    CREATE POLICY "Users can view all profiles"
      ON public.profiles
      FOR SELECT
      USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can update any profile') THEN
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can manage admin_setup' AND tablename='admin_setup') THEN
    CREATE POLICY "Admins can manage admin_setup"
      ON public.admin_setup
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view admin_setup' AND tablename='admin_setup') THEN
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can insert their own details' AND tablename='driver_details') THEN
    CREATE POLICY "Drivers can insert their own details"
      ON public.driver_details
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can update their own details' AND tablename='driver_details') THEN
    CREATE POLICY "Drivers can update their own details"
      ON public.driver_details
      FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view their own details' AND tablename='driver_details') THEN
    CREATE POLICY "Drivers can view their own details"
      ON public.driver_details
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all driver details' AND tablename='driver_details') THEN
    CREATE POLICY "Admins can view all driver details"
      ON public.driver_details
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view driver details for rides' AND tablename='driver_details') THEN
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can manage pricing settings' AND tablename='pricing_settings') THEN
    CREATE POLICY "Admins can manage pricing settings"
      ON public.pricing_settings
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Everyone can view pricing settings' AND tablename='pricing_settings') THEN
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can manage their own location' AND tablename='locations') THEN
    CREATE POLICY "Users can manage their own location"
      ON public.locations
      FOR ALL
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Passengers can view driver location for active rides' AND tablename='locations') THEN
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view locations for active rides' AND tablename='locations') THEN
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all rides' AND tablename='rides') THEN
    CREATE POLICY "Admins can view all rides"
      ON public.rides
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Passengers can create rides' AND tablename='rides') THEN
    CREATE POLICY "Passengers can create rides"
      ON public.rides
      FOR INSERT
      WITH CHECK (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Passengers can update their rides' AND tablename='rides') THEN
    CREATE POLICY "Passengers can update their rides"
      ON public.rides
      FOR UPDATE
      USING (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Passengers can view their rides' AND tablename='rides') THEN
    CREATE POLICY "Passengers can view their rides"
      ON public.rides
      FOR SELECT
      USING (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can accept pending rides' AND tablename='rides') THEN
    CREATE POLICY "Drivers can accept pending rides"
      ON public.rides
      FOR UPDATE
      USING (
        (driver_id IS NULL AND status = 'pending') OR 
        (driver_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view pending rides' AND tablename='rides') THEN
    CREATE POLICY "Drivers can view pending rides"
      ON public.rides
      FOR SELECT
      USING (
        (status = 'pending' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'driver')) OR 
        (driver_id = auth.uid())
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
-- Tabela: ride_ratings (Avaliações de corridas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ride_ratings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ride_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  reviewee_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para ride_ratings
ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ride_ratings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all ratings' AND tablename='ride_ratings') THEN
    CREATE POLICY "Admins can view all ratings"
      ON public.ride_ratings
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can create ratings for their rides' AND tablename='ride_ratings') THEN
    CREATE POLICY "Users can create ratings for their rides"
      ON public.ride_ratings
      FOR INSERT
      WITH CHECK (
        reviewer_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.rides
          WHERE rides.id = ride_id
            AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
            AND rides.status = 'completed'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view ratings they gave or received' AND tablename='ride_ratings') THEN
    CREATE POLICY "Users can view ratings they gave or received"
      ON public.ride_ratings
      FOR SELECT
      USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());
  END IF;
END $$;

-- Trigger para updated_at em ride_ratings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='ride_ratings_set_updated_at') THEN
    CREATE TRIGGER ride_ratings_set_updated_at
      BEFORE UPDATE ON public.ride_ratings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: driver_passenger_ratings (Avaliações entre motoristas e passageiros)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_passenger_ratings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ride_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para driver_passenger_ratings
ALTER TABLE public.driver_passenger_ratings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para driver_passenger_ratings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all driver passenger ratings' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Admins can view all driver passenger ratings"
      ON public.driver_passenger_ratings
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can create driver passenger ratings for their rides' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Users can create driver passenger ratings for their rides"
      ON public.driver_passenger_ratings
      FOR INSERT
      WITH CHECK (
        created_by = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.rides
          WHERE rides.id = ride_id
            AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
            AND rides.status = 'completed'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view driver passenger ratings for their rides' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Users can view driver passenger ratings for their rides"
      ON public.driver_passenger_ratings
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.rides
        WHERE rides.id = ride_id
          AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
      ));
  END IF;
END $$;

-- Trigger para updated_at em driver_passenger_ratings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='driver_passenger_ratings_set_updated_at') THEN
    CREATE TRIGGER driver_passenger_ratings_set_updated_at
      BEFORE UPDATE ON public.driver_passenger_ratings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: driver_payout_requests (Solicitações de saque de motoristas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_payout_requests (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  driver_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status public.payout_status DEFAULT 'pending',
  payment_method TEXT NOT NULL,
  payment_details JSONB NOT NULL,
  notes TEXT,
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para driver_payout_requests
ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para driver_payout_requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Admins can view all payout requests"
      ON public.driver_payout_requests
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can update payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Admins can update payout requests"
      ON public.driver_payout_requests
      FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can create payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Drivers can create payout requests"
      ON public.driver_payout_requests
      FOR INSERT
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view their payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Drivers can view their payout requests"
      ON public.driver_payout_requests
      FOR SELECT
      USING (driver_id = auth.uid());
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
  driver_id UUID PRIMARY KEY,
  total_earnings NUMERIC DEFAULT 0 CHECK (total_earnings >= 0),
  available NUMERIC DEFAULT 0 CHECK (available >= 0),
  reserved NUMERIC DEFAULT 0 CHECK (reserved >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para driver_balances
ALTER TABLE public.driver_balances ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para driver_balances
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all driver balances' AND tablename='driver_balances') THEN
    CREATE POLICY "Admins can view all driver balances"
      ON public.driver_balances
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view their own balance' AND tablename='driver_balances') THEN
    CREATE POLICY "Drivers can view their own balance"
      ON public.driver_balances
      FOR SELECT
      USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='System can manage driver balances' AND tablename='driver_balances') THEN
    CREATE POLICY "System can manage driver balances"
      ON public.driver_balances
      FOR ALL
      USING (TRUE);
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
-- Tabela: fee_payments (Pagamentos de taxas de serviço)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  driver_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  status public.fee_status DEFAULT 'not_requested',
  initial_due_date TIMESTAMPTZ NOT NULL,
  payment_due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  canceled_reason TEXT,
  available_balance_before NUMERIC DEFAULT 0,
  actual_fee_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para fee_payments
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fee_payments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all fee payments' AND tablename='fee_payments') THEN
    CREATE POLICY "Admins can view all fee payments"
      ON public.fee_payments
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can update fee payments' AND tablename='fee_payments') THEN
    CREATE POLICY "Admins can update fee payments"
      ON public.fee_payments
      FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view their own fee payments' AND tablename='fee_payments') THEN
    CREATE POLICY "Drivers can view their own fee payments"
      ON public.fee_payments
      FOR SELECT
      USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='System can manage fee payments' AND tablename='fee_payments') THEN
    CREATE POLICY "System can manage fee payments"
      ON public.fee_payments
      FOR ALL
      USING (TRUE);
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

-- =============================================================================
-- FUNÇÕES RPC (Remote Procedure Calls)
-- =============================================================================

-- Função para solicitar pagamento de taxa
CREATE OR REPLACE FUNCTION public.request_fee_payment()
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id UUID;
  v_profile_created_at TIMESTAMPTZ;
  v_initial_deadline TIMESTAMPTZ;
  v_payment_deadline TIMESTAMPTZ;
  v_available_balance NUMERIC;
  v_service_fee_settings RECORD;
  v_service_fee_amount NUMERIC;
  v_fee_payment RECORD;
BEGIN
  -- Verificar autenticação
  v_driver_id := auth.uid();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verificar se é motorista
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_driver_id AND user_type = 'driver') THEN
    RAISE EXCEPTION 'not_a_driver';
  END IF;

  -- Buscar data de criação do perfil
  SELECT created_at INTO v_profile_created_at
  FROM public.profiles
  WHERE id = v_driver_id;

  -- Calcular prazo inicial (2 dias após cadastro)
  v_initial_deadline := v_profile_created_at + INTERVAL '2 days';
  
  -- Verificar se ainda está dentro do prazo inicial
  IF NOW() > v_initial_deadline THEN
    RAISE EXCEPTION 'initial_deadline_expired';
  END IF;

  -- Verificar se já tem taxa pendente ou expirada
  IF EXISTS (
    SELECT 1 FROM public.fee_payments
    WHERE driver_id = v_driver_id
      AND status IN ('pending', 'expired')
  ) THEN
    RAISE EXCEPTION 'active_fee_exists';
  END IF;

  -- Buscar saldo disponível
  SELECT COALESCE(available, 0) INTO v_available_balance
  FROM public.driver_balances
  WHERE driver_id = v_driver_id;

  -- Se não existe, não há saldo disponível
  IF v_available_balance IS NULL THEN
    v_available_balance := 0;
  END IF;

  -- Verificar se tem saldo disponível
  IF v_available_balance <= 0 THEN
    RAISE EXCEPTION 'no_available_funds';
  END IF;

  -- Buscar configurações da taxa de serviço
  SELECT service_fee_type, service_fee_value
  INTO v_service_fee_settings
  FROM public.pricing_settings
  ORDER BY created_at DESC
  LIMIT 1;

  -- Calcular valor da taxa
  IF v_service_fee_settings.service_fee_type = 'fixed' THEN
    v_service_fee_amount := COALESCE(v_service_fee_settings.service_fee_value, 0);
  ELSIF v_service_fee_settings.service_fee_type = 'percent' THEN
    v_service_fee_amount := v_available_balance * (COALESCE(v_service_fee_settings.service_fee_value, 0) / 100);
  ELSE
    v_service_fee_amount := 0;
  END IF;

  -- Verificar se a taxa é válida
  IF v_service_fee_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_fee_amount';
  END IF;

  -- Verificar se tem saldo suficiente para a taxa
  IF v_available_balance < v_service_fee_amount THEN
    RAISE EXCEPTION 'insufficient_funds_for_fee';
  END IF;

  -- Calcular prazo de pagamento (2 dias a partir de agora)
  v_payment_deadline := NOW() + INTERVAL '2 days';

  -- Criar solicitação de taxa
  INSERT INTO public.fee_payments (
    driver_id,
    amount,
    status,
    initial_due_date,
    payment_due_date,
    available_balance_before,
    actual_fee_amount
  ) VALUES (
    v_driver_id,
    v_available_balance,
    'pending',
    v_initial_deadline,
    v_payment_deadline,
    v_available_balance,
    v_service_fee_amount
  ) RETURNING * INTO v_fee_payment;

  -- Atualizar saldo do motorista (reservar valor da taxa)
  INSERT INTO public.driver_balances (driver_id, total_earnings, available, reserved)
  VALUES (v_driver_id, v_available_balance, 0, v_service_fee_amount)
  ON CONFLICT (driver_id) DO UPDATE SET
    available = v_available_balance - v_service_fee_amount,
    reserved = driver_balances.reserved + v_service_fee_amount,
    updated_at = NOW();

  RETURN v_fee_payment;
END;
$$;

-- Função para marcar taxa como paga
CREATE OR REPLACE FUNCTION public.mark_fee_paid(p_fee_id UUID)
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fee_payment RECORD;
  v_current_user_id UUID;
BEGIN
  -- Verificar autenticação
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Verificar se é admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_current_user_id AND user_type = 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Buscar a solicitação de taxa
  SELECT * INTO v_fee_payment
  FROM public.fee_payments
  WHERE id = p_fee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fee_not_found';
  END IF;

  -- Verificar se está em status válido
  IF v_fee_payment.status != 'pending' THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Marcar como paga
  UPDATE public.fee_payments
  SET 
    status = 'paid',
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_fee_id
  RETURNING * INTO v_fee_payment;

  -- Remover valor reservado do saldo do motorista
  UPDATE public.driver_balances
  SET 
    reserved = reserved - v_fee_payment.actual_fee_amount,
    updated_at = NOW()
  WHERE driver_id = v_fee_payment.driver_id;

  RETURN v_fee_payment;
END;
$$;

-- Função para cancelar taxa
CREATE OR REPLACE FUNCTION public.cancel_fee(p_fee_id UUID, p_reason TEXT)
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fee_payment RECORD;
  v_current_user_id UUID;
BEGIN
  -- Verificar autenticação
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Verificar se é admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_current_user_id AND user_type = 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Buscar a solicitação de taxa
  SELECT * INTO v_fee_payment
  FROM public.fee_payments
  WHERE id = p_fee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fee_not_found';
  END IF;

  -- Verificar se está em status válido
  IF v_fee_payment.status NOT IN ('pending', 'expired') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Cancelar a taxa
  UPDATE public.fee_payments
  SET 
    status = 'canceled',
    canceled_at = NOW(),
    canceled_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_fee_id
  RETURNING * INTO v_fee_payment;

  -- Devolver valor reservado para saldo disponível
  UPDATE public.driver_balances
  SET 
    available = available + v_fee_payment.actual_fee_amount,
    reserved = reserved - v_fee_payment.actual_fee_amount,
    updated_at = NOW()
  WHERE driver_id = v_fee_payment.driver_id;

  RETURN v_fee_payment;
END;
$$;

-- Função para calcular saldo do motorista
CREATE OR REPLACE FUNCTION public.calculate_driver_balance(p_driver_id UUID)
RETURNS public.driver_balances
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_earnings NUMERIC DEFAULT 0;
  v_reserved NUMERIC DEFAULT 0;
  v_available NUMERIC DEFAULT 0;
  v_balance RECORD;
BEGIN
  -- Calcular ganhos totais de corridas completadas
  SELECT COALESCE(SUM(actual_price), 0) INTO v_total_earnings
  FROM public.rides
  WHERE driver_id = p_driver_id AND status = 'completed';

  -- Calcular valor reservado para taxas pendentes
  SELECT COALESCE(SUM(actual_fee_amount), 0) INTO v_reserved
  FROM public.fee_payments
  WHERE driver_id = p_driver_id AND status IN ('pending', 'expired');

  -- Calcular disponível
  v_available := v_total_earnings - v_reserved;

  -- Garantir que não seja negativo
  IF v_available < 0 THEN
    v_available := 0;
  END IF;

  -- Inserir ou atualizar saldo
  INSERT INTO public.driver_balances (driver_id, total_earnings, available, reserved)
  VALUES (p_driver_id, v_total_earnings, v_available, v_reserved)
  ON CONFLICT (driver_id) DO UPDATE SET
    total_earnings = EXCLUDED.total_earnings,
    available = EXCLUDED.available,
    reserved = EXCLUDED.reserved,
    updated_at = NOW()
  RETURNING * INTO v_balance;

  RETURN v_balance;
END;
$$;

-- =============================================================================
-- CONFIGURAÇÕES DE REAL-TIME
-- =============================================================================

-- Habilitar real-time para tabelas que precisam de atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_passenger_ratings;

-- Configurar REPLICA IDENTITY para capturar dados completos nas atualizações
ALTER TABLE public.locations REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.ride_ratings REPLICA IDENTITY FULL;
ALTER TABLE public.driver_passenger_ratings REPLICA IDENTITY FULL;