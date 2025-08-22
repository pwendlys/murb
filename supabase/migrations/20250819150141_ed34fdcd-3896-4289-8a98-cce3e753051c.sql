
-- 1) Permitir que administradores vejam todos os detalhes de motoristas
CREATE POLICY "Admins can view all driver details"
  ON public.driver_details
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.user_type = 'admin'
    )
  );

-- 2) Permitir que administradores atualizem qualquer perfil (para aprovar/desativar motoristas)
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.user_type = 'admin'
    )
  );
