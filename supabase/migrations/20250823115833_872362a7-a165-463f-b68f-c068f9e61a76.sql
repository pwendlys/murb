-- Modificar função calculate_service_fee para calcular sobre saldo disponível
CREATE OR REPLACE FUNCTION public.calculate_service_fee(p_driver_id uuid, p_available_balance numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings record;
  v_fee_amount numeric(14,2) := 0;
BEGIN
  -- Buscar configurações de preço mais recentes
  SELECT service_fee_type, service_fee_value
  INTO v_settings
  FROM public.pricing_settings
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se não houver configurações, retorna 0
  IF NOT FOUND OR v_settings.service_fee_value IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calcular taxa baseada no tipo
  IF v_settings.service_fee_type = 'fixed' THEN
    v_fee_amount := v_settings.service_fee_value;
  ELSIF v_settings.service_fee_type = 'percent' THEN
    -- Calcular porcentagem sobre o saldo disponível
    v_fee_amount := p_available_balance * (v_settings.service_fee_value / 100);
  END IF;
  
  -- Garantir que não seja negativo e não exceda o saldo disponível
  RETURN GREATEST(0, LEAST(v_fee_amount, p_available_balance));
END
$function$;

-- Modificar função request_fee_payment para implementar nova lógica
CREATE OR REPLACE FUNCTION public.request_fee_payment()
 RETURNS fee_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_driver_id uuid := auth.uid();
  v_balance public.driver_balances;
  v_payment public.fee_payments;
  v_profile_created_at timestamptz;
  v_now timestamptz := now();
  v_fee_amount numeric(14,2);
  v_initial_due_date timestamptz;
  v_available_balance numeric(14,2);
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
  v_available_balance := v_balance.available;

  -- Verifica se tem saldo disponível
  IF v_available_balance <= 0 THEN
    RAISE EXCEPTION 'no_available_funds';
  END IF;

  -- Calcula taxa baseada no saldo disponível
  v_fee_amount := public.calculate_service_fee(v_driver_id, v_available_balance);
  
  -- Verifica se a taxa calculada é maior que zero
  IF v_fee_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_fee_amount';
  END IF;

  -- NOVA LÓGICA: Zerar todo o saldo disponível
  -- Todo o saldo disponível vai para reservado, mas só a taxa é paga
  UPDATE public.driver_balances
  SET available = 0,
      reserved = reserved + v_available_balance
  WHERE driver_id = v_driver_id;

  -- Cria fee_payment com informações detalhadas
  INSERT INTO public.fee_payments (
    driver_id, 
    amount, 
    status, 
    initial_due_date, 
    payment_due_date,
    available_balance_before,
    actual_fee_amount
  )
  VALUES (
    v_driver_id, 
    v_available_balance,  -- O valor total reservado é o saldo disponível
    'pending', 
    v_initial_due_date, 
    v_now + interval '2 days',
    v_available_balance,  -- Saldo antes da solicitação
    v_fee_amount          -- Valor real da taxa
  )
  RETURNING * INTO v_payment;

  RETURN v_payment;
END
$function$;

-- Modificar função mark_fee_paid para usar nova lógica
CREATE OR REPLACE FUNCTION public.mark_fee_paid(p_fee_id uuid)
 RETURNS fee_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Liberar apenas o que sobrou após deduzir a taxa
  -- amount = saldo total reservado, actual_fee_amount = taxa paga
  UPDATE public.driver_balances
  SET reserved = GREATEST(reserved - v_payment.amount, 0),
      available = available + GREATEST(v_payment.amount - v_payment.actual_fee_amount, 0)
  WHERE driver_id = v_payment.driver_id;

  UPDATE public.fee_payments
  SET status = 'paid',
      paid_at = now()
  WHERE id = p_fee_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END
$function$;