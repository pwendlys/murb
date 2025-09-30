-- ============================================
-- CORREÇÃO DO SISTEMA DE ASSINATURAS
-- ============================================

-- 1. REMOVER DEFAULT TEMPORARIAMENTE
ALTER TABLE driver_subscriptions 
  ALTER COLUMN status DROP DEFAULT;

-- 2. RENOMEAR ENUM E CRIAR NOVO COM CASCADE
ALTER TYPE subscription_status RENAME TO subscription_status_old;

CREATE TYPE subscription_status AS ENUM ('ativa', 'vencida', 'bloqueada', 'renovacao_solicitada');

-- Atualizar a coluna com conversão de tipos
ALTER TABLE driver_subscriptions 
  ALTER COLUMN status TYPE subscription_status 
  USING (
    CASE status::text
      WHEN 'ativa' THEN 'ativa'::subscription_status
      WHEN 'vencida' THEN 'vencida'::subscription_status
      WHEN 'cancelada' THEN 'vencida'::subscription_status
      WHEN 'pendente' THEN 'renovacao_solicitada'::subscription_status
      ELSE 'vencida'::subscription_status
    END
  );

-- Recriar default
ALTER TABLE driver_subscriptions 
  ALTER COLUMN status SET DEFAULT 'ativa'::subscription_status;

-- Remover tipo antigo com CASCADE (remove funções dependentes)
DROP TYPE subscription_status_old CASCADE;

-- 3. RECRIAR FUNÇÃO get_driver_subscription_status COM TIPO CORRETO
CREATE OR REPLACE FUNCTION public.get_driver_subscription_status(p_driver_id uuid)
RETURNS TABLE(
  subscription_id uuid,
  plan_name text,
  duration_days integer,
  price_cents integer,
  status subscription_status,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  days_remaining integer,
  has_pending_request boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id,
    sp.name,
    sp.duration_days,
    sp.price_cents,
    CASE 
      WHEN ds.end_date < NOW() THEN 'vencida'::subscription_status
      ELSE ds.status
    END,
    ds.start_date,
    ds.end_date,
    GREATEST(0, EXTRACT(DAY FROM ds.end_date - NOW())::INTEGER),
    EXISTS(
      SELECT 1 
      FROM public.subscription_requests sr 
      WHERE sr.driver_id = p_driver_id 
      AND sr.status = 'pending'
    )
  FROM public.driver_subscriptions ds
  JOIN public.subscription_plans sp ON sp.id = ds.plan_id
  WHERE ds.driver_id = p_driver_id
  ORDER BY ds.created_at DESC
  LIMIT 1;
END;
$function$;

-- 4. ADICIONAR FOREIGN KEYS
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_driver_subscriptions_plan'
  ) THEN
    ALTER TABLE driver_subscriptions
      ADD CONSTRAINT fk_driver_subscriptions_plan
      FOREIGN KEY (plan_id) 
      REFERENCES subscription_plans(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_subscription_requests_plan'
  ) THEN
    ALTER TABLE subscription_requests
      ADD CONSTRAINT fk_subscription_requests_plan
      FOREIGN KEY (plan_id)
      REFERENCES subscription_plans(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_subscription_requests_current_subscription'
  ) THEN
    ALTER TABLE subscription_requests
      ADD CONSTRAINT fk_subscription_requests_current_subscription
      FOREIGN KEY (current_subscription_id)
      REFERENCES driver_subscriptions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 5. INSERIR DADOS DE SEED
INSERT INTO subscription_plans (name, duration_days, price_cents, is_active)
SELECT 'Meia Assinatura', 15, 6000, true
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_plans WHERE name = 'Meia Assinatura'
);

INSERT INTO subscription_plans (name, duration_days, price_cents, is_active)
SELECT 'Assinatura Completa', 30, 10000, true
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_plans WHERE name = 'Assinatura Completa'
);

-- 6. ADICIONAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_driver_subscriptions_driver_status 
  ON driver_subscriptions(driver_id, status);

CREATE INDEX IF NOT EXISTS idx_driver_subscriptions_plan 
  ON driver_subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_driver_status 
  ON subscription_requests(driver_id, status);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_plan 
  ON subscription_requests(plan_id);

-- 7. VERIFICAÇÃO
DO $$
DECLARE
  plan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO plan_count FROM subscription_plans WHERE is_active = true;
  RAISE NOTICE '✓ Sistema de assinaturas corrigido!';
  RAISE NOTICE '✓ Planos ativos: %', plan_count;
  RAISE NOTICE '✓ Enum atualizado: ativa, vencida, bloqueada, renovacao_solicitada';
  RAISE NOTICE '✓ Foreign keys e índices criados';
END $$;