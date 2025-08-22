
-- 1) Create the pricing_settings table
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT TRUE,
  price_per_km_active BOOLEAN NOT NULL DEFAULT TRUE,
  price_per_km NUMERIC NOT NULL DEFAULT 2.5,
  fixed_price_active BOOLEAN NOT NULL DEFAULT FALSE,
  fixed_price NUMERIC NULL,
  service_fee_type TEXT NOT NULL DEFAULT 'fixed',
  service_fee_value NUMERIC NOT NULL DEFAULT 0,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_fee_type_valid CHECK (service_fee_type IN ('fixed', 'percent'))
);

-- Ensure only one active (singleton) settings row
CREATE UNIQUE INDEX IF NOT EXISTS one_pricing_row
  ON public.pricing_settings (singleton)
  WHERE singleton;

-- 2) Keep updated_at fresh with a trigger
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
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 3) Enable Row Level Security
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- 4) Policies
-- Everyone (including anon) can read settings (needed for fare preview on the client)
DROP POLICY IF EXISTS "Anyone can read pricing settings" ON public.pricing_settings;
CREATE POLICY "Anyone can read pricing settings"
  ON public.pricing_settings
  FOR SELECT
  USING (true);

-- Only admins can insert
DROP POLICY IF EXISTS "Only admins can insert pricing settings" ON public.pricing_settings;
CREATE POLICY "Only admins can insert pricing settings"
  ON public.pricing_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.user_type = 'admin'
    )
  );

-- Only admins can update
DROP POLICY IF EXISTS "Only admins can update pricing settings" ON public.pricing_settings;
CREATE POLICY "Only admins can update pricing settings"
  ON public.pricing_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.user_type = 'admin'
    )
  );
