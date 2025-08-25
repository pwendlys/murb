-- Criar política RLS para permitir passageiros verem detalhes do motorista durante corridas ativas
CREATE POLICY "Passengers can view driver details during active rides" 
ON public.driver_details 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.rides 
  WHERE rides.driver_id = driver_details.user_id 
  AND rides.passenger_id = auth.uid() 
  AND rides.status IN ('accepted', 'in_progress')
));