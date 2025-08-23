-- Remover função existente e recriar com novos parâmetros
DROP FUNCTION IF EXISTS public.calculate_service_fee(uuid, numeric);

-- Criar nova função calculate_service_fee para calcular sobre saldo disponível
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