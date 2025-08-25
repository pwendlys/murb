-- Adicionar política para permitir que admins atualizem qualquer perfil
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profiles
    WHERE admin_profiles.id = auth.uid() 
    AND admin_profiles.user_type = 'admin'
  )
);