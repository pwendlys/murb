-- Corrigir avisos de segurança das funções adicionando search_path

-- 1. Função para calcular saldos do motorista
CREATE OR REPLACE FUNCTION public.calculate_driver_balance(p_driver_id uuid)
RETURNS public.driver_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance public.driver_balances;
  v_total_earnings numeric(14,2) := 0;
  v_paid_withdrawals numeric(14,2) := 0;
  v_reserved numeric(14,2) := 0;
BEGIN
  -- Calcula total de ganhos das corridas completadas
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

-- 2. Função RPC para solicitar pagamento
CREATE OR REPLACE FUNCTION public.request_fee_payment()
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid := auth.uid();
  v_balance public.driver_balances;
  v_payment public.fee_payments;
  v_profile_created_at timestamptz;
  v_now timestamptz := now();
  v_amount numeric(14,2);
  v_initial_due_date timestamptz;
BEGIN
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verifica se é um motorista
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_driver_id AND user_type = 'driver') THEN
    RAISE EXCEPTION 'not_a_driver';
  END IF;

  -- Busca data de criação do perfil
  SELECT created_at INTO v_profile_created_at
  FROM public.profiles
  WHERE id = v_driver_id;

  v_initial_due_date := v_profile_created_at + interval '2 days';

  -- Verifica se ainda está no prazo para solicitar (2 dias após cadastro)
  IF v_now > v_initial_due_date THEN
    RAISE EXCEPTION 'initial_deadline_expired';
  END IF;

  -- Calcula e obtém saldo atual
  SELECT * INTO v_balance FROM public.calculate_driver_balance(v_driver_id);

  IF v_balance.available <= 0 THEN
    RAISE EXCEPTION 'no_available_funds';
  END IF;

  v_amount := v_balance.available; -- 100% do disponível no momento

  -- Atualiza saldos: move available -> reserved
  UPDATE public.driver_balances
  SET available = available - v_amount,
      reserved  = reserved  + v_amount
  WHERE driver_id = v_driver_id;

  -- Cria fee_payment pendente com vencimento em 2 dias para pagamento
  INSERT INTO public.fee_payments (driver_id, amount, status, initial_due_date, payment_due_date)
  VALUES (v_driver_id, v_amount, 'pending', v_initial_due_date, v_now + interval '2 days')
  RETURNING * INTO v_payment;

  RETURN v_payment;
END
$$;

-- 3. Função para marcar como pago
CREATE OR REPLACE FUNCTION public.mark_fee_paid(p_fee_id uuid)
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.fee_payments;
BEGIN
  -- Verifica se é admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_payment FROM public.fee_payments WHERE id = p_fee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'fee_not_found'; END IF;
  
  IF v_payment.status NOT IN ('pending', 'expired') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Libera a reserva (reserved diminui), não mexe no total_earnings
  UPDATE public.driver_balances
  SET reserved = GREATEST(reserved - v_payment.amount, 0)
  WHERE driver_id = v_payment.driver_id;

  UPDATE public.fee_payments
  SET status  = 'paid',
      paid_at = now()
  WHERE id = p_fee_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END
$$;

-- 4. Função para cancelar taxa
CREATE OR REPLACE FUNCTION public.cancel_fee(p_fee_id uuid, p_reason text)
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.fee_payments;
BEGIN
  -- Verifica se é admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_payment FROM public.fee_payments WHERE id = p_fee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'fee_not_found'; END IF;
  
  IF v_payment.status NOT IN ('pending', 'expired') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Reverte a reserva para available
  UPDATE public.driver_balances
  SET reserved  = GREATEST(reserved - v_payment.amount, 0),
      available = available + v_payment.amount
  WHERE driver_id = v_payment.driver_id;

  UPDATE public.fee_payments
  SET status          = 'canceled',
      canceled_at     = now(),
      canceled_reason = p_reason
  WHERE id = p_fee_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END
$$;