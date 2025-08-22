-- Adicionar políticas RLS para bloquear mototaxistas inativos de funcionalidades específicas

-- Atualizar política para que apenas mototaxistas ativos possam aceitar corridas
DROP POLICY IF EXISTS "Drivers can accept rides" ON public.rides;
CREATE POLICY "Active drivers can accept rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  (driver_id = auth.uid() AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND user_type = 'driver' 
    AND is_active = TRUE
  )) 
  OR 
  (driver_id IS NULL AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND user_type = 'driver' 
    AND is_active = TRUE
  ))
);

-- Atualizar política para que apenas mototaxistas ativos vejam corridas disponíveis
DROP POLICY IF EXISTS "Drivers can view available rides" ON public.rides;
CREATE POLICY "Active drivers can view available rides"
ON public.rides
FOR SELECT
TO authenticated
USING (
  (driver_id IS NULL AND status = 'pending' AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND user_type = 'driver' 
    AND is_active = TRUE
  ))
  OR
  (passenger_id = auth.uid() OR driver_id = auth.uid())
);

-- Garantir que apenas mototaxistas ativos possam atualizar localizações
DROP POLICY IF EXISTS "Users can manage their own location" ON public.locations;
CREATE POLICY "Users can manage their own location"
ON public.locations
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() 
  AND (
    -- Passageiros podem sempre atualizar
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'passenger')
    OR
    -- Mototaxistas só se estiverem ativos
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'driver' AND is_active = TRUE)
    OR
    -- Admins podem sempre atualizar
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  )
);