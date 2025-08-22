-- =============================================================================
-- PROJETO RIDE-SHARING - PARTE 2: TABELAS PRINCIPAIS
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
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

ALTER TABLE public.admin_setup ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can manage admin_setup' AND tablename='admin_setup') THEN
    CREATE POLICY "Admins can manage admin_setup"
      ON public.admin_setup
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'admin_setup_set_updated_at') THEN
    CREATE TRIGGER admin_setup_set_updated_at
      BEFORE UPDATE ON public.admin_setup
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

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- Constraint para garantir apenas uma linha ativa
CREATE UNIQUE INDEX IF NOT EXISTS one_pricing_row ON public.pricing_settings (singleton) WHERE singleton;

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

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Índices para performance e upsert
CREATE UNIQUE INDEX IF NOT EXISTS locations_user_id_key ON public.locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_time ON public.locations(user_id, timestamp DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can manage their own location' AND tablename='locations') THEN
    CREATE POLICY "Users can manage their own location"
      ON public.locations
      FOR ALL
      USING (user_id = auth.uid());
  END IF;
END $$;