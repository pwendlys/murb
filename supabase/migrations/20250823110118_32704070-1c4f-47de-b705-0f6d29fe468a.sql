-- Atualizar função calculate_driver_balance para deduzir taxas pagas
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
  v_paid_fees numeric(14,2) := 0;
  v_reserved numeric(14,2) := 0;
BEGIN
  -- Calcula total de ganhos das corridas completadas
  SELECT COALESCE(SUM(COALESCE(actual_price, estimated_price)), 0)
  INTO v_total_earnings
  FROM public.rides
  WHERE driver_id = p_driver_id AND status = 'completed';

  -- Calcula total de saques pagos
  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid_withdrawals
  FROM public.driver_payout_requests
  WHERE driver_id = p_driver_id AND status = 'paid';

  -- Calcula total de taxas pagas (NOVA DEDUÇÃO)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid_fees
  FROM public.fee_payments
  WHERE driver_id = p_driver_id AND status = 'paid';

  -- Calcula reservado para taxas pendentes/expiradas
  SELECT COALESCE(SUM(amount), 0)
  INTO v_reserved
  FROM public.fee_payments
  WHERE driver_id = p_driver_id AND status IN ('pending', 'expired');

  -- Insere ou atualiza saldo: disponível = ganhos - saques pagos - taxas pagas - reservado
  INSERT INTO public.driver_balances (driver_id, total_earnings, available, reserved)
  VALUES (p_driver_id, v_total_earnings, GREATEST(0, v_total_earnings - v_paid_withdrawals - v_paid_fees - v_reserved), v_reserved)
  ON CONFLICT (driver_id) DO UPDATE SET
    total_earnings = EXCLUDED.total_earnings,
    available = GREATEST(0, EXCLUDED.total_earnings - v_paid_withdrawals - v_paid_fees - EXCLUDED.reserved),
    reserved = EXCLUDED.reserved,
    updated_at = now()
  RETURNING * INTO v_balance;

  RETURN v_balance;
END
$function$;

-- Criar trigger para recalcular saldos quando taxa for marcada como paga
CREATE OR REPLACE FUNCTION public.update_driver_balance_on_fee_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Recalcular saldo quando status da taxa mudar para 'paid' ou 'canceled'
  IF (NEW.status != OLD.status) AND (NEW.status IN ('paid', 'canceled')) THEN
    PERFORM public.calculate_driver_balance(NEW.driver_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Aplicar trigger na tabela fee_payments
DROP TRIGGER IF EXISTS update_driver_balance_on_fee_change ON public.fee_payments;
CREATE TRIGGER update_driver_balance_on_fee_change
  AFTER UPDATE ON public.fee_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_driver_balance_on_fee_status_change();