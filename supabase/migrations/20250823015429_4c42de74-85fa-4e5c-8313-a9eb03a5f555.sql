-- Corrigir funções para ter search_path definido
CREATE OR REPLACE FUNCTION public.set_actual_price_on_completion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se mudou para 'completed' e actual_price ainda é null, usar estimated_price
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.actual_price IS NULL THEN
    NEW.actual_price = NEW.estimated_price;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_driver_balance_on_ride_completion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se mudou para 'completed', atualiza o saldo do motorista
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.driver_id IS NOT NULL THEN
    PERFORM public.calculate_driver_balance(NEW.driver_id);
  END IF;
  RETURN NEW;
END;
$$;