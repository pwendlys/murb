
-- Permite que o passageiro visualize os detalhes do motorista APENAS
-- quando houver uma corrida que envolva ambos (sem abrir acesso geral).
ALTER TABLE public.driver_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Passengers can view driver details for their rides" ON public.driver_details;

CREATE POLICY "Passengers can view driver details for their rides"
  ON public.driver_details
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.rides
      WHERE rides.driver_id = driver_details.user_id
        AND rides.passenger_id = auth.uid()
    )
  );
