-- =============================================================================
-- FUNÇÕES RPC (Remote Procedure Calls) - PARTE FINAL
-- =============================================================================

-- Função para solicitar pagamento de taxa
CREATE OR REPLACE FUNCTION public.request_fee_payment()
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_profile_created_at TIMESTAMPTZ;
  v_initial_deadline TIMESTAMPTZ;
  v_payment_deadline TIMESTAMPTZ;
  v_available_balance NUMERIC;
  v_service_fee_settings RECORD;
  v_service_fee_amount NUMERIC;
  v_fee_payment RECORD;
BEGIN
  -- Verificar autenticação
  v_driver_id := auth.uid();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verificar se é motorista
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_driver_id AND user_type = 'driver') THEN
    RAISE EXCEPTION 'not_a_driver';
  END IF;

  -- Buscar data de criação do perfil
  SELECT created_at INTO v_profile_created_at
  FROM public.profiles
  WHERE id = v_driver_id;

  -- Calcular prazo inicial (2 dias após cadastro)
  v_initial_deadline := v_profile_created_at + INTERVAL '2 days';
  
  -- Verificar se ainda está dentro do prazo inicial
  IF NOW() > v_initial_deadline THEN
    RAISE EXCEPTION 'initial_deadline_expired';
  END IF;

  -- Verificar se já tem taxa pendente ou expirada
  IF EXISTS (
    SELECT 1 FROM public.fee_payments
    WHERE driver_id = v_driver_id
      AND status IN ('pending', 'expired')
  ) THEN
    RAISE EXCEPTION 'active_fee_exists';
  END IF;

  -- Buscar saldo disponível
  SELECT COALESCE(available, 0) INTO v_available_balance
  FROM public.driver_balances
  WHERE driver_id = v_driver_id;

  -- Se não existe, não há saldo disponível
  IF v_available_balance IS NULL THEN
    v_available_balance := 0;
  END IF;

  -- Verificar se tem saldo disponível
  IF v_available_balance <= 0 THEN
    RAISE EXCEPTION 'no_available_funds';
  END IF;

  -- Buscar configurações da taxa de serviço
  SELECT service_fee_type, service_fee_value
  INTO v_service_fee_settings
  FROM public.pricing_settings
  ORDER BY created_at DESC
  LIMIT 1;

  -- Calcular valor da taxa
  IF v_service_fee_settings.service_fee_type = 'fixed' THEN
    v_service_fee_amount := COALESCE(v_service_fee_settings.service_fee_value, 0);
  ELSIF v_service_fee_settings.service_fee_type = 'percent' THEN
    v_service_fee_amount := v_available_balance * (COALESCE(v_service_fee_settings.service_fee_value, 0) / 100);
  ELSE
    v_service_fee_amount := 0;
  END IF;

  -- Verificar se a taxa é válida
  IF v_service_fee_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_fee_amount';
  END IF;

  -- Verificar se tem saldo suficiente para a taxa
  IF v_available_balance < v_service_fee_amount THEN
    RAISE EXCEPTION 'insufficient_funds_for_fee';
  END IF;

  -- Calcular prazo de pagamento (2 dias a partir de agora)
  v_payment_deadline := NOW() + INTERVAL '2 days';

  -- Criar solicitação de taxa
  INSERT INTO public.fee_payments (
    driver_id,
    amount,
    status,
    initial_due_date,
    payment_due_date,
    available_balance_before,
    actual_fee_amount
  ) VALUES (
    v_driver_id,
    v_available_balance,
    'pending',
    v_initial_deadline,
    v_payment_deadline,
    v_available_balance,
    v_service_fee_amount
  ) RETURNING * INTO v_fee_payment;

  -- Atualizar saldo do motorista (reservar valor da taxa)
  INSERT INTO public.driver_balances (driver_id, total_earnings, available, reserved)
  VALUES (v_driver_id, v_available_balance, 0, v_service_fee_amount)
  ON CONFLICT (driver_id) DO UPDATE SET
    available = v_available_balance - v_service_fee_amount,
    reserved = driver_balances.reserved + v_service_fee_amount,
    updated_at = NOW();

  RETURN v_fee_payment;
END;
$$;

-- Função para marcar taxa como paga
CREATE OR REPLACE FUNCTION public.mark_fee_paid(p_fee_id UUID)
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_payment RECORD;
  v_current_user_id UUID;
BEGIN
  -- Verificar autenticação
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Verificar se é admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_current_user_id AND user_type = 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Buscar a solicitação de taxa
  SELECT * INTO v_fee_payment
  FROM public.fee_payments
  WHERE id = p_fee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fee_not_found';
  END IF;

  -- Verificar se está em status válido
  IF v_fee_payment.status != 'pending' THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Marcar como paga
  UPDATE public.fee_payments
  SET 
    status = 'paid',
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_fee_id
  RETURNING * INTO v_fee_payment;

  -- Remover valor reservado do saldo do motorista
  UPDATE public.driver_balances
  SET 
    reserved = reserved - v_fee_payment.actual_fee_amount,
    updated_at = NOW()
  WHERE driver_id = v_fee_payment.driver_id;

  RETURN v_fee_payment;
END;
$$;

-- Função para cancelar taxa
CREATE OR REPLACE FUNCTION public.cancel_fee(p_fee_id UUID, p_reason TEXT)
RETURNS public.fee_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_payment RECORD;
  v_current_user_id UUID;
BEGIN
  -- Verificar autenticação
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Verificar se é admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_current_user_id AND user_type = 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Buscar a solicitação de taxa
  SELECT * INTO v_fee_payment
  FROM public.fee_payments
  WHERE id = p_fee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fee_not_found';
  END IF;

  -- Verificar se está em status válido
  IF v_fee_payment.status NOT IN ('pending', 'expired') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Cancelar a taxa
  UPDATE public.fee_payments
  SET 
    status = 'canceled',
    canceled_at = NOW(),
    canceled_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_fee_id
  RETURNING * INTO v_fee_payment;

  -- Devolver valor reservado para saldo disponível
  UPDATE public.driver_balances
  SET 
    available = available + v_fee_payment.actual_fee_amount,
    reserved = reserved - v_fee_payment.actual_fee_amount,
    updated_at = NOW()
  WHERE driver_id = v_fee_payment.driver_id;

  RETURN v_fee_payment;
END;
$$;

-- Função para calcular saldo do motorista
CREATE OR REPLACE FUNCTION public.calculate_driver_balance(p_driver_id UUID)
RETURNS public.driver_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_earnings NUMERIC DEFAULT 0;
  v_reserved NUMERIC DEFAULT 0;
  v_available NUMERIC DEFAULT 0;
  v_balance RECORD;
BEGIN
  -- Calcular ganhos totais de corridas completadas
  SELECT COALESCE(SUM(actual_price), 0) INTO v_total_earnings
  FROM public.rides
  WHERE driver_id = p_driver_id AND status = 'completed';

  -- Calcular valor reservado para taxas pendentes
  SELECT COALESCE(SUM(actual_fee_amount), 0) INTO v_reserved
  FROM public.fee_payments
  WHERE driver_id = p_driver_id AND status IN ('pending', 'expired');

  -- Calcular disponível
  v_available := v_total_earnings - v_reserved;

  -- Garantir que não seja negativo
  IF v_available < 0 THEN
    v_available := 0;
  END IF;

  -- Inserir ou atualizar saldo
  INSERT INTO public.driver_balances (driver_id, total_earnings, available, reserved)
  VALUES (p_driver_id, v_total_earnings, v_available, v_reserved)
  ON CONFLICT (driver_id) DO UPDATE SET
    total_earnings = EXCLUDED.total_earnings,
    available = EXCLUDED.available,
    reserved = EXCLUDED.reserved,
    updated_at = NOW()
  RETURNING * INTO v_balance;

  RETURN v_balance;
END;
$$;