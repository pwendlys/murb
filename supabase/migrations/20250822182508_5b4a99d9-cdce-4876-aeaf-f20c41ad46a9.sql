-- =============================================================================
-- PROJETO RIDE-SHARING - PARTE 4: TABELAS DE AVALIAÇÕES E SISTEMA DE PAGAMENTOS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: ride_ratings (Avaliações de passageiros para motoristas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ride_ratings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ride_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  passenger_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ride_ratings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Passengers can create ratings' AND tablename='ride_ratings') THEN
    CREATE POLICY "Passengers can create ratings"
      ON public.ride_ratings
      FOR INSERT
      WITH CHECK (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Passengers can update their ratings' AND tablename='ride_ratings') THEN
    CREATE POLICY "Passengers can update their ratings"
      ON public.ride_ratings
      FOR UPDATE
      USING (passenger_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view ratings for their rides' AND tablename='ride_ratings') THEN
    CREATE POLICY "Users can view ratings for their rides"
      ON public.ride_ratings
      FOR SELECT
      USING ((passenger_id = auth.uid()) OR (driver_id = auth.uid()));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: driver_passenger_ratings (Avaliações de motoristas para passageiros)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_passenger_ratings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ride_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  passenger_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.driver_passenger_ratings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para driver_passenger_ratings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can create passenger ratings' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Drivers can create passenger ratings"
      ON public.driver_passenger_ratings
      FOR INSERT
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can update passenger ratings' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Drivers can update passenger ratings"
      ON public.driver_passenger_ratings
      FOR UPDATE
      USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users can view driver ratings' AND tablename='driver_passenger_ratings') THEN
    CREATE POLICY "Users can view driver ratings"
      ON public.driver_passenger_ratings
      FOR SELECT
      USING ((driver_id = auth.uid()) OR (passenger_id = auth.uid()));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: driver_payout_requests (Solicitações de pagamento dos motoristas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_payout_requests (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  driver_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_details JSONB,
  status public.payout_status DEFAULT 'pending',
  notes TEXT,
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_driver ON public.driver_payout_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.driver_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created ON public.driver_payout_requests(created_at);

-- Políticas RLS para driver_payout_requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can create payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Drivers can create payout requests"
      ON public.driver_payout_requests
      FOR INSERT
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Drivers can view their own payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Drivers can view their own payout requests"
      ON public.driver_payout_requests
      FOR SELECT
      USING (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can view all payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Admins can view all payout requests"
      ON public.driver_payout_requests
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Admins can update payout requests' AND tablename='driver_payout_requests') THEN
    CREATE POLICY "Admins can update payout requests"
      ON public.driver_payout_requests
      FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- Trigger para updated_at em driver_payout_requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='driver_payout_requests_set_updated_at') THEN
    CREATE TRIGGER driver_payout_requests_set_updated_at
      BEFORE UPDATE ON public.driver_payout_requests
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tabela: chat_messages (Mensagens de chat entre motoristas e passageiros)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ride_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_ride_created ON public.chat_messages(ride_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_unread ON public.chat_messages(receiver_id, read_at);

-- Políticas RLS para chat_messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Participants can insert messages during active rides' AND tablename='chat_messages') THEN
    CREATE POLICY "Participants can insert messages during active rides"
      ON public.chat_messages
      FOR INSERT
      WITH CHECK (
        (sender_id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.rides r
          WHERE r.id = chat_messages.ride_id
            AND r.status IN ('accepted', 'in_progress')
            AND (
              (chat_messages.sender_id = r.driver_id AND chat_messages.receiver_id = r.passenger_id)
              OR
              (chat_messages.sender_id = r.passenger_id AND chat_messages.receiver_id = r.driver_id)
            )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Participants can select chat messages for their rides' AND tablename='chat_messages') THEN
    CREATE POLICY "Participants can select chat messages for their rides"
      ON public.chat_messages
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.rides r
          WHERE r.id = chat_messages.ride_id
            AND (auth.uid() = r.driver_id OR auth.uid() = r.passenger_id)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Receiver can update message read status' AND tablename='chat_messages') THEN
    CREATE POLICY "Receiver can update message read status"
      ON public.chat_messages
      FOR UPDATE
      USING (receiver_id = auth.uid())
      WITH CHECK (receiver_id = auth.uid());
  END IF;
END $$;