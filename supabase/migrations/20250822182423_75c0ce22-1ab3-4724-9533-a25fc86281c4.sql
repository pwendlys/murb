-- =============================================================================
-- PROJETO RIDE-SHARING - PARTE 3: TABELAS DEPENDENTES
-- =============================================================================

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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can accept rides' AND tablename='rides') THEN
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view their own rides' AND tablename='rides') THEN
    CREATE POLICY "Users can view their own rides"
      ON public.rides
      FOR SELECT
      USING ((passenger_id = auth.uid()) OR (driver_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view available rides' AND tablename='rides') THEN
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

-- Agora podemos adicionar as políticas de locations que dependem de rides
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