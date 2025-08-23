-- Corrigir função calculate_driver_balance para usar COALESCE(actual_price, estimated_price)
CREATE OR REPLACE FUNCTION public.calculate_driver_balance(p_driver_id uuid)
 RETURNS driver_balances
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_balance public.driver_balances;
  v_total_earnings numeric(14,2) := 0;
  v_paid_withdrawals numeric(14,2) := 0;
  v_reserved numeric(14,2) := 0;
BEGIN
  -- Calcula total de ganhos das corridas completadas usando COALESCE
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
$$;

-- Função para definir actual_price automaticamente
CREATE OR REPLACE FUNCTION public.set_actual_price_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a corrida está sendo marcada como completed e não tem actual_price definido
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.actual_price IS NULL THEN
    NEW.actual_price = NEW.estimated_price;
  END IF;
  RETURN NEW;
END;
$$;

-- Função para atualizar saldos automaticamente
CREATE OR REPLACE FUNCTION public.update_driver_balance_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a corrida foi marcada como completed e tem driver_id
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.driver_id IS NOT NULL THEN
    -- Chama a função para recalcular saldos
    PERFORM public.calculate_driver_balance(NEW.driver_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Criar triggers para rides
DROP TRIGGER IF EXISTS set_actual_price_on_ride_completion ON public.rides;
CREATE TRIGGER set_actual_price_on_ride_completion
  BEFORE UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_actual_price_on_completion();

DROP TRIGGER IF EXISTS update_driver_balance_on_ride_completion ON public.rides;
CREATE TRIGGER update_driver_balance_on_ride_completion
  AFTER UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_driver_balance_on_completion();

-- Inicializar saldos para todos os motoristas existentes que completaram corridas
DO $$
DECLARE
  driver_rec RECORD;
BEGIN
  FOR driver_rec IN 
    SELECT DISTINCT r.driver_id
    FROM public.rides r
    JOIN public.profiles p ON p.id = r.driver_id
    WHERE r.status = 'completed' 
      AND r.driver_id IS NOT NULL
      AND p.user_type = 'driver'
  LOOP
    PERFORM public.calculate_driver_balance(driver_rec.driver_id);
  END LOOP;
END
$$;