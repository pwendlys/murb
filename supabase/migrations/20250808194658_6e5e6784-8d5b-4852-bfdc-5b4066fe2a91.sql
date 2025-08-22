
-- Adicionar colunas para controlar quando o motorista está indo até o passageiro
ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS driver_en_route BOOLEAN DEFAULT false;

ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS en_route_started_at TIMESTAMPTZ NULL;

ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS driver_to_pickup_distance_km NUMERIC NULL;

ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS driver_to_pickup_duration_min INTEGER NULL;
