
-- 1) Permitir que administradores atualizem qualquer perfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can update any profile'
  ) THEN
    CREATE POLICY "Admins can update any profile"
      ON public.profiles
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.user_type = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.user_type = 'admin'
        )
      );
  END IF;
END
$$;

-- 2) Garantir que a tabela profiles esteja habilitada para Realtime
-- Captura a linha completa em updates para que o payload chegue no frontend
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Adiciona a tabela profiles à publicação supabase_realtime (ignora se já estiver adicionada)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION
    WHEN duplicate_object THEN
      -- A tabela já está na publicação; não faz nada
      NULL;
  END;
END
$$;

-- 3) Opcional recomendado: manter updated_at em profiles sempre atualizado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_profiles_updated_at'
  ) THEN
    CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;
