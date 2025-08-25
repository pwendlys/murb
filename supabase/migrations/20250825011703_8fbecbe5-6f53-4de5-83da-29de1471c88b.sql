-- =============================================================================
-- PROJETO RIDE-SHARING - BACKUP COMPLETO (ORDEM CORRIGIDA)
-- =============================================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Tipos customizados
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE public.payout_status AS ENUM ('pending', 'approved', 'rejected', 'paid');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fee_status') THEN
    CREATE TYPE public.fee_status AS ENUM ('not_requested', 'pending', 'paid', 'canceled', 'expired');
  END IF;
END $$;

-- Função utilitária
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

-- Trigger para auth
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
-- CRIAR TODAS AS TABELAS PRIMEIRO (SEM POLÍTICAS RLS)
-- =============================================================================

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  user_type TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin setup
CREATE TABLE IF NOT EXISTS public.admin_setup (
  admin_user_id UUID NOT NULL PRIMARY KEY,
  password_set BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Driver details
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

-- Pricing settings
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  price_per_km NUMERIC DEFAULT 2.50,
  fixed_price NUMERIC,
  price_per_km_active BOOLEAN DEFAULT TRUE,
  fixed_price_active BOOLEAN DEFAULT FALSE,
  service_fee_type TEXT DEFAULT 'fixed',
  service_fee_value NUMERIC DEFAULT 0,
  singleton BOOLEAN DEFAULT TRUE,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Rides
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
  status TEXT DEFAULT 'pending',
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

-- Ride ratings
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

-- Driver passenger ratings
CREATE TABLE IF NOT EXISTS public.driver_passenger_ratings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ride_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Driver payout requests
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

-- Driver balances
CREATE TABLE IF NOT EXISTS public.driver_balances (
  driver_id UUID PRIMARY KEY,
  total_earnings NUMERIC DEFAULT 0 CHECK (total_earnings >= 0),
  available NUMERIC DEFAULT 0 CHECK (available >= 0),
  reserved NUMERIC DEFAULT 0 CHECK (reserved >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee payments
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

-- =============================================================================
-- CRIAR ÍNDICES E CONSTRAINTS
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS one_pricing_row ON public.pricing_settings (singleton) WHERE singleton;
CREATE UNIQUE INDEX IF NOT EXISTS locations_user_id_key ON public.locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_time ON public.locations(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON public.rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);

-- =============================================================================
-- HABILITAR RLS
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_passenger_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- CRIAR POLÍTICAS RLS (AGORA QUE TODAS AS TABELAS EXISTEM)
-- =============================================================================

-- Profiles policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can insert their own profile' AND tablename='profiles') THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can update their own profile' AND tablename='profiles') THEN
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view all profiles' AND tablename='profiles') THEN
    CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (TRUE);
  END IF;
END $$;

-- Admin setup policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can manage admin_setup' AND tablename='admin_setup') THEN
    CREATE POLICY "Admins can manage admin_setup" ON public.admin_setup FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- Driver details policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can manage their own details' AND tablename='driver_details') THEN
    CREATE POLICY "Drivers can manage their own details" ON public.driver_details FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all driver details' AND tablename='driver_details') THEN
    CREATE POLICY "Admins can view all driver details" ON public.driver_details FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- Pricing settings policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Everyone can view pricing settings' AND tablename='pricing_settings') THEN
    CREATE POLICY "Everyone can view pricing settings" ON public.pricing_settings FOR SELECT USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can manage pricing settings' AND tablename='pricing_settings') THEN
    CREATE POLICY "Admins can manage pricing settings" ON public.pricing_settings FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- Locations policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can manage their own location' AND tablename='locations') THEN
    CREATE POLICY "Users can manage their own location" ON public.locations FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view locations for active rides' AND tablename='locations') THEN
    CREATE POLICY "Users can view locations for active rides" ON public.locations FOR SELECT 
    USING (EXISTS (
      SELECT 1 FROM public.rides
      WHERE ((rides.passenger_id = auth.uid()) OR (rides.driver_id = auth.uid()))
        AND rides.status IN ('accepted', 'in_progress')
        AND ((rides.driver_id = locations.user_id) OR (rides.passenger_id = locations.user_id))
    ));
  END IF;
END $$;

-- Rides policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Passengers can create rides' AND tablename='rides') THEN
    CREATE POLICY "Passengers can create rides" ON public.rides FOR INSERT WITH CHECK (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view their rides' AND tablename='rides') THEN
    CREATE POLICY "Users can view their rides" ON public.rides FOR SELECT 
    USING (passenger_id = auth.uid() OR driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view pending rides' AND tablename='rides') THEN
    CREATE POLICY "Drivers can view pending rides" ON public.rides FOR SELECT 
    USING (status = 'pending' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'driver'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can update their rides' AND tablename='rides') THEN
    CREATE POLICY "Users can update their rides" ON public.rides FOR UPDATE 
    USING (passenger_id = auth.uid() OR driver_id = auth.uid() OR (driver_id IS NULL AND status = 'pending'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all rides' AND tablename='rides') THEN
    CREATE POLICY "Admins can view all rides" ON public.rides FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- Ride ratings policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can manage ratings for their rides' AND tablename='ride_ratings') THEN
    CREATE POLICY "Users can manage ratings for their rides" ON public.ride_ratings FOR ALL 
    USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());
  END IF;
END $$;

-- Driver passenger ratings policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can manage driver passenger ratings' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Users can manage driver passenger ratings" ON public.driver_passenger_ratings FOR ALL 
    USING (created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_id AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
    ));
  END IF;
END $$;

-- Driver payout requests policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can manage their payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Drivers can manage their payout requests" ON public.driver_payout_requests FOR ALL USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Admins can view all payout requests" ON public.driver_payout_requests FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- Driver balances policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view their own balance' AND tablename='driver_balances') THEN
    CREATE POLICY "Drivers can view their own balance" ON public.driver_balances FOR SELECT USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='System can manage driver balances' AND tablename='driver_balances') THEN
    CREATE POLICY "System can manage driver balances" ON public.driver_balances FOR ALL USING (TRUE);
  END IF;
END $$;

-- Fee payments policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view their own fee payments' AND tablename='fee_payments') THEN
    CREATE POLICY "Drivers can view their own fee payments" ON public.fee_payments FOR SELECT USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can manage fee payments' AND tablename='fee_payments') THEN
    CREATE POLICY "Admins can manage fee payments" ON public.fee_payments FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='System can manage fee payments' AND tablename='fee_payments') THEN
    CREATE POLICY "System can manage fee payments" ON public.fee_payments FOR ALL USING (TRUE);
  END IF;
END $$;

-- =============================================================================
-- CRIAR TRIGGERS
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_set_updated_at') THEN
    CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'admin_setup_set_updated_at') THEN
    CREATE TRIGGER admin_setup_set_updated_at BEFORE UPDATE ON public.admin_setup FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'driver_details_set_updated_at') THEN
    CREATE TRIGGER driver_details_set_updated_at BEFORE UPDATE ON public.driver_details FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pricing_settings_set_updated_at') THEN
    CREATE TRIGGER pricing_settings_set_updated_at BEFORE UPDATE ON public.pricing_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rides_set_updated_at') THEN
    CREATE TRIGGER rides_set_updated_at BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ride_ratings_set_updated_at') THEN
    CREATE TRIGGER ride_ratings_set_updated_at BEFORE UPDATE ON public.ride_ratings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'driver_passenger_ratings_set_updated_at') THEN
    CREATE TRIGGER driver_passenger_ratings_set_updated_at BEFORE UPDATE ON public.driver_passenger_ratings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'driver_payout_requests_set_updated_at') THEN
    CREATE TRIGGER driver_payout_requests_set_updated_at BEFORE UPDATE ON public.driver_payout_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'driver_balances_set_updated_at') THEN
    CREATE TRIGGER driver_balances_set_updated_at BEFORE UPDATE ON public.driver_balances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fee_payments_set_updated_at') THEN
    CREATE TRIGGER fee_payments_set_updated_at BEFORE UPDATE ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- =============================================================================
-- DADOS INICIAIS
-- =============================================================================

INSERT INTO public.pricing_settings (price_per_km, fixed_price, price_per_km_active, fixed_price_active, service_fee_type, service_fee_value, singleton)
SELECT 2.50, NULL, TRUE, FALSE, 'fixed', 0, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_settings);

-- =============================================================================
-- CONFIGURAÇÕES DE REAL-TIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_passenger_ratings;

ALTER TABLE public.locations REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.ride_ratings REPLICA IDENTITY FULL;
ALTER TABLE public.driver_passenger_ratings REPLICA IDENTITY FULL;