-- =============================================================================
-- PROJETO RIDE-SHARING - PARTE 5: ÍNDICES, REALTIME E STORAGE (CORRIGIDO)
-- =============================================================================

-- =============================================================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =============================================================================

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);

-- Índices para driver_details
CREATE INDEX IF NOT EXISTS idx_driver_details_user_id ON public.driver_details(user_id);

-- Índices para ride_ratings
CREATE INDEX IF NOT EXISTS idx_ride_ratings_ride_id ON public.ride_ratings(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_driver_id ON public.ride_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_passenger_id ON public.ride_ratings(passenger_id);

-- Índices para driver_passenger_ratings
CREATE INDEX IF NOT EXISTS idx_driver_passenger_ratings_ride_id ON public.driver_passenger_ratings(ride_id);
CREATE INDEX IF NOT EXISTS idx_driver_passenger_ratings_driver_id ON public.driver_passenger_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_passenger_ratings_passenger_id ON public.driver_passenger_ratings(passenger_id);

-- =============================================================================
-- CONFIGURAÇÕES DE TEMPO REAL (REALTIME)
-- =============================================================================

-- Configurar replica identity para payload completo em UPDATE
ALTER TABLE public.locations REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- =============================================================================
-- STORAGE (ARMAZENAMENTO DE ARQUIVOS)
-- =============================================================================

-- Criar bucket para avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Políticas para storage.objects (CORRIGIDAS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public can read avatars'
  ) THEN
    CREATE POLICY "Public can read avatars"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated can upload avatars'
  ) THEN
    CREATE POLICY "Authenticated can upload avatars"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update their own avatar'
  ) THEN
    CREATE POLICY "Users can update their own avatar"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'avatars' AND owner = auth.uid()::text)
      WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid()::text);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete their own avatar'
  ) THEN
    CREATE POLICY "Users can delete their own avatar"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'avatars' AND owner = auth.uid()::text);
  END IF;
END $$;

-- =============================================================================
-- DADOS INICIAIS (SEED DATA)
-- =============================================================================

-- Inserir configuração inicial do admin (placeholder)
INSERT INTO public.admin_setup (admin_user_id, password_set)
VALUES ('00000000-0000-0000-0000-000000000000', FALSE)
ON CONFLICT (admin_user_id) DO NOTHING;