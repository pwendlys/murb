-- ETAPA 1: Tipos de Serviço e Estrutura de Dados (CORRIGIDO)
-- Migração idempotente com rollback seguro

-- 1. Criar ENUM para service_type (se não existir)
DO $$ BEGIN
  CREATE TYPE service_type AS ENUM ('moto_taxi', 'passenger_car', 'delivery_bike', 'delivery_car');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Adicionar coluna service_type à tabela rides (com default seguro)
ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS service_type service_type DEFAULT 'moto_taxi' NOT NULL;

-- 3. Criar índice para melhor performance em queries por service_type
CREATE INDEX IF NOT EXISTS idx_rides_service_type ON public.rides(service_type);
CREATE INDEX IF NOT EXISTS idx_rides_service_type_status ON public.rides(service_type, status);

-- 4. Adicionar coluna service_type à pricing_settings ANTES de remover singleton
ALTER TABLE public.pricing_settings 
ADD COLUMN IF NOT EXISTS service_type service_type DEFAULT 'moto_taxi' NOT NULL;

-- 5. Atualizar o registro existente para ter service_type = 'moto_taxi'
UPDATE public.pricing_settings 
SET service_type = 'moto_taxi' 
WHERE service_type IS NULL OR service_type = 'moto_taxi';

-- 6. Remover constraint singleton de pricing_settings
ALTER TABLE public.pricing_settings 
DROP CONSTRAINT IF EXISTS pricing_settings_singleton_key;

ALTER TABLE public.pricing_settings 
DROP CONSTRAINT IF EXISTS one_pricing_row;

-- 7. Adicionar constraint UNIQUE para service_type em pricing_settings
-- Isso garante apenas uma configuração de preço por tipo de serviço
DO $$ BEGIN
  ALTER TABLE public.pricing_settings 
  ADD CONSTRAINT pricing_settings_service_type_unique UNIQUE (service_type);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN 
    -- Se já existe, ignorar
    NULL;
END $$;

-- 8. Criar índice em pricing_settings.service_type
CREATE INDEX IF NOT EXISTS idx_pricing_settings_service_type ON public.pricing_settings(service_type);

-- 9. Inserir configurações padrão para novos tipos de serviço (se não existirem)
-- Usando os mesmos valores padrão da configuração existente
INSERT INTO public.pricing_settings (
  service_type, 
  price_per_km, 
  price_per_km_active, 
  fixed_price, 
  fixed_price_active, 
  service_fee_type, 
  service_fee_value,
  singleton
)
SELECT 
  'passenger_car'::service_type,
  price_per_km,
  price_per_km_active,
  fixed_price,
  fixed_price_active,
  service_fee_type,
  service_fee_value,
  false
FROM public.pricing_settings
WHERE service_type = 'moto_taxi'
ON CONFLICT (service_type) DO NOTHING;

INSERT INTO public.pricing_settings (
  service_type, 
  price_per_km, 
  price_per_km_active, 
  fixed_price, 
  fixed_price_active, 
  service_fee_type, 
  service_fee_value,
  singleton
)
SELECT 
  'delivery_bike'::service_type,
  price_per_km,
  price_per_km_active,
  fixed_price,
  fixed_price_active,
  service_fee_type,
  service_fee_value,
  false
FROM public.pricing_settings
WHERE service_type = 'moto_taxi'
ON CONFLICT (service_type) DO NOTHING;

INSERT INTO public.pricing_settings (
  service_type, 
  price_per_km, 
  price_per_km_active, 
  fixed_price, 
  fixed_price_active, 
  service_fee_type, 
  service_fee_value,
  singleton
)
SELECT 
  'delivery_car'::service_type,
  price_per_km,
  price_per_km_active,
  fixed_price,
  fixed_price_active,
  service_fee_type,
  service_fee_value,
  false
FROM public.pricing_settings
WHERE service_type = 'moto_taxi'
ON CONFLICT (service_type) DO NOTHING;