
-- Adicionar política RLS para permitir que passageiros cancelem suas próprias corridas pendentes
CREATE POLICY "Passengers can cancel own pending rides" ON public.rides
FOR UPDATE 
USING (
  auth.uid() = passenger_id AND 
  status = 'pending'
)
WITH CHECK (
  auth.uid() = passenger_id AND 
  status IN ('pending', 'cancelled')
);
