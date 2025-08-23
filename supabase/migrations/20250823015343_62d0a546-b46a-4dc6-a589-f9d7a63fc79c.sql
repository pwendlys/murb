-- Corrigir função calculate_driver_balance para usar COALESCE(actual_price, estimated_price)
CREATE OR REPLACE FUNCTION public.calculate_driver_balance(p_driver_id uuid)
 RETURNS driver_balances
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance public.driver_balances;
  v_total_earnings numeric(14,2) := 0;
  v_paid_withdrawals numeric(14,2) := 0;
  v_reserved numeric(14,2) := 0;
BEGIN
  -- Calcula total de ganhos das corridas completadas usando COALESCE para pegar actual_price ou estimated_price
  SELECT COALESCE(SUM(COALESCE(actual_price, estimated_price)), 0)
  INTO v_total_earnings
  FROM public.rides
  WHERE driver_id = p_driver_id AND status = 'completed';

  -- Calcula total de saques pagos (sistema antigo)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid_withdrawals
  FROM public.driver_payout_requests
  WHERE driver_id = p_driver_id AND status = 'paid';

  -- Calcula reservado para taxas pendentes/expiradas
  SELECT COALESCE(SUM(amount), 0)
  INTO v_reserved
  FROM public.fee_payments
  WHERE driver_id = p_driver_id AND status IN ('pending', 'expired');

  -- Insere ou atualiza saldo
  INSERT INTO public.driver_balances (driver_id, total_earnings, available, reserved)
  VALUES (p_driver_id, v_total_earnings, GREATEST(0, v_total_earnings - v_paid_withdrawals - v_reserved), v_reserved)
  ON CONFLICT (driver_id) DO UPDATE SET
    total_earnings = EXCLUDED.total_earnings,
    available = GREATEST(0, EXCLUDED.total_earnings - v_paid_withdrawals - EXCLUDED.reserved),
    reserved = EXCLUDED.reserved,
    updated_at = now()
  RETURNING * INTO v_balance;

  RETURN v_balance;
END
$function$;

-- Função para definir actual_price quando não informado
CREATE OR REPLACE FUNCTION public.set_actual_price_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Se mudou para 'completed' e actual_price ainda é null, usar estimated_price
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.actual_price IS NULL THEN
    NEW.actual_price = NEW.estimated_price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar saldo automaticamente quando corrida é finalizada
CREATE OR REPLACE FUNCTION public.update_driver_balance_on_ride_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Se mudou para 'completed', atualiza o saldo do motorista
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.driver_id IS NOT NULL THEN
    PERFORM public.calculate_driver_balance(NEW.driver_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers
DROP TRIGGER IF EXISTS set_actual_price_on_completion_trigger ON public.rides;
CREATE TRIGGER set_actual_price_on_completion_trigger
  BEFORE UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_actual_price_on_completion();

DROP TRIGGER IF EXISTS update_driver_balance_on_completion_trigger ON public.rides;
CREATE TRIGGER update_driver_balance_on_completion_trigger
  AFTER UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_driver_balance_on_ride_completion();

-- Inicializar saldos para todos os motoristas existentes
-- Primeiro, identifica todos os motoristas que têm corridas
INSERT INTO public.driver_balances (driver_id, total_earnings, available, reserved)
SELECT 
  p.id as driver_id,
  0 as total_earnings,
  0 as available, 
  0 as reserved
FROM public.profiles p
WHERE p.user_type = 'driver'
  AND NOT EXISTS (SELECT 1 FROM public.driver_balances db WHERE db.driver_id = p.id)
ON CONFLICT (driver_id) DO NOTHING;

-- Agora calcula os saldos corretos para todos os motoristas
DO $$
DECLARE
  driver_record RECORD;
BEGIN
  FOR driver_record IN 
    SELECT DISTINCT p.id as driver_id
    FROM public.profiles p
    WHERE p.user_type = 'driver'
  LOOP
    PERFORM public.calculate_driver_balance(driver_record.driver_id);
  END LOOP;
END $$;