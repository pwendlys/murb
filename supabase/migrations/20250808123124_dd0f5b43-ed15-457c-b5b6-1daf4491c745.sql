
-- 1) Tabela de Configurações de Preços (singleton)
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true, -- garante linha única
  price_per_km_active boolean NOT NULL DEFAULT true,
  price_per_km numeric(10,2) NOT NULL DEFAULT 2.50,
  fixed_price_active boolean NOT NULL DEFAULT false,
  fixed_price numeric(10,2),
  service_fee_type text NOT NULL DEFAULT 'fixed', -- 'fixed' ou 'percent'
  service_fee_value numeric(10,2) NOT NULL DEFAULT 0.00,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricing_settings_singleton_unique UNIQUE (singleton),
  CONSTRAINT service_fee_type_valid CHECK (service_fee_type IN ('fixed','percent')),
  CONSTRAINT non_negative_values CHECK (
    price_per_km >= 0 AND
    (fixed_price IS NULL OR fixed_price >= 0) AND
    service_fee_value >= 0
  )
);

-- Habilitar RLS
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
-- Qualquer usuário autenticado pode ler (passageiro/motorista precisam calcular preço)
CREATE POLICY "Anyone authenticated can read pricing settings"
  ON public.pricing_settings
  FOR SELECT
  USING (true);

-- Somente administradores podem inserir
CREATE POLICY "Only admins can insert pricing settings"
  ON public.pricing_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
    )
  );

-- Somente administradores podem atualizar
CREATE POLICY "Only admins can update pricing settings"
  ON public.pricing_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
    )
  );

-- Atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_pricing_settings_updated_at ON public.pricing_settings;
CREATE TRIGGER set_pricing_settings_updated_at
BEFORE UPDATE ON public.pricing_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Realtime para a tabela de configurações
ALTER TABLE public.pricing_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_settings';
  END IF;
END$$;

-- 3) Permissões de administrador
-- Admin pode atualizar qualquer perfil (ex.: promover/demover, ativar/desativar)
CREATE POLICY IF NOT EXISTS "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
  );

-- Admin pode ver todas as corridas
CREATE POLICY IF NOT EXISTS "Admins can view all rides"
  ON public.rides
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
  );

-- Admin pode atualizar qualquer corrida (ex.: corrigir status)
CREATE POLICY IF NOT EXISTS "Admins can update any ride"
  ON public.rides
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
  );
