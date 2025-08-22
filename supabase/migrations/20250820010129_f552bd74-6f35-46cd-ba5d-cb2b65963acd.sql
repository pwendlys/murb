
-- Adicionar política RLS para permitir que passageiros vejam localização do motorista durante corridas ativas
CREATE POLICY "Passengers can view driver location for active rides" 
  ON public.locations 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 
      FROM rides 
      WHERE rides.passenger_id = auth.uid() 
        AND rides.driver_id = locations.user_id 
        AND rides.status IN ('accepted', 'in_progress')
    )
  );
