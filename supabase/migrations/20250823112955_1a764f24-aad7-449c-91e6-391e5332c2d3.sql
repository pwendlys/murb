-- Função auxiliar para calcular taxa de serviço baseada nas configurações
CREATE OR REPLACE FUNCTION public.calculate_service_fee(p_driver_id uuid, p_total_earnings numeric)
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
    v_fee_amount := p_total_earnings * (v_settings.service_fee_value / 100);
  END IF;
  
  -- Garantir que não seja negativo
  RETURN GREATEST(0, ROUND(v_fee_amount, 2));
END
$function$;

-- Atualizar função request_fee_payment para usar configurações de taxa
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

  -- Calcula taxa baseada nas configurações administrativas
  v_fee_amount := public.calculate_service_fee(v_driver_id, v_balance.total_earnings);
  
  -- Verifica se a taxa calculada é maior que zero
  IF v_fee_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_fee_amount';
  END IF;

  -- Verifica se tem saldo disponível para cobrir a taxa
  IF v_balance.available < v_fee_amount THEN
    RAISE EXCEPTION 'insufficient_funds_for_fee';
  END IF;

  -- Atualiza saldos: move available -> reserved (apenas o valor da taxa)
  UPDATE public.driver_balances
  SET available = available - v_fee_amount,
      reserved  = reserved  + v_fee_amount
  WHERE driver_id = v_driver_id;

  -- Cria fee_payment pendente com o valor calculado da taxa
  INSERT INTO public.fee_payments (driver_id, amount, status, initial_due_date, payment_due_date)
  VALUES (v_driver_id, v_fee_amount, 'pending', v_initial_due_date, v_now + interval '2 days')
  RETURNING * INTO v_payment;

  RETURN v_payment;
END
$function$;