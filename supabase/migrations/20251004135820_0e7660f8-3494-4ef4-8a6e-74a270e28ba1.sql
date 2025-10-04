-- Etapa 4: Criar tabela de regras de disponibilidade
CREATE TABLE service_availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type service_type NOT NULL,
  region TEXT NOT NULL,
  weekday_mask INTEGER[] NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  active BOOLEAN DEFAULT true,
  surge_multiplier NUMERIC DEFAULT 1.0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (time_end > time_start),
  CONSTRAINT valid_weekdays CHECK (array_length(weekday_mask, 1) > 0),
  CONSTRAINT valid_surge CHECK (surge_multiplier >= 1.0)
);

-- Índice para performance
CREATE INDEX idx_availability_service_region ON service_availability_rules(service_type, region, active);

-- Enable RLS
ALTER TABLE service_availability_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Admin full access
CREATE POLICY "Admins can manage availability rules"
  ON service_availability_rules
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- Policy: Public read-only para regras ativas
CREATE POLICY "Anyone can view active availability rules"
  ON service_availability_rules
  FOR SELECT
  USING (active = true);

-- Seed data: regras de exemplo
INSERT INTO service_availability_rules (service_type, region, weekday_mask, time_start, time_end, surge_multiplier, notes) VALUES
  ('moto_taxi', 'juiz_de_fora', ARRAY[1,2,3,4,5,6,7], '00:00', '23:59', 1.0, 'Disponível 24/7'),
  ('passenger_car', 'juiz_de_fora', ARRAY[1,2,3,4,5], '06:00', '22:00', 1.0, 'Seg-Sex, 6h-22h'),
  ('passenger_car', 'juiz_de_fora', ARRAY[6,7], '08:00', '20:00', 1.2, 'Fim de semana com surge'),
  ('delivery_bike', 'juiz_de_fora', ARRAY[1,2,3,4,5], '08:00', '20:00', 1.0, 'Delivery seg-sex'),
  ('delivery_bike', 'juiz_de_fora', ARRAY[1,2,3,4,5], '12:00', '14:00', 1.3, 'Horário de pico - almoço'),
  ('delivery_bike', 'juiz_de_fora', ARRAY[1,2,3,4,5], '18:00', '20:00', 1.3, 'Horário de pico - jantar'),
  ('delivery_car', 'juiz_de_fora', ARRAY[1,2,3,4,5,6,7], '08:00', '22:00', 1.0, 'Delivery car todos os dias');

-- Adicionar campos para delivery na tabela rides
ALTER TABLE rides ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS package_description TEXT;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS recipient_phone TEXT;