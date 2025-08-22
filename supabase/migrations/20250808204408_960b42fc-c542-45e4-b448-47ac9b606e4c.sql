
-- Campos adicionais na tabela rides para controlar chegada ao passageiro
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS driver_arrived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_arrived_at TIMESTAMPTZ NULL;
