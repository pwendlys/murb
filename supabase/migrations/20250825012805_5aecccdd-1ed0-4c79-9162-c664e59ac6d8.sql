-- Criar tabela chat_messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (LENGTH(TRIM(text)) > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir que sender e receiver sejam diferentes
  CONSTRAINT different_sender_receiver CHECK (sender_id != receiver_id)
);

-- Habilitar RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX idx_chat_messages_ride_id ON public.chat_messages(ride_id);
CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_receiver_id ON public.chat_messages(receiver_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX idx_chat_messages_unread ON public.chat_messages(receiver_id, read_at) WHERE read_at IS NULL;

-- Políticas RLS
-- Usuários podem ver mensagens de corridas em que participam
CREATE POLICY "Users can view messages from their rides"
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rides 
    WHERE rides.id = chat_messages.ride_id 
    AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
  )
);

-- Usuários podem enviar mensagens se forem participantes da corrida
CREATE POLICY "Users can send messages in their rides"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.rides 
    WHERE rides.id = chat_messages.ride_id 
    AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.rides 
    WHERE rides.id = chat_messages.ride_id 
    AND (rides.passenger_id = receiver_id OR rides.driver_id = receiver_id)
  )
);

-- Usuários podem atualizar (marcar como lida) mensagens destinadas a eles
CREATE POLICY "Users can update messages sent to them"
ON public.chat_messages
FOR UPDATE
USING (receiver_id = auth.uid())
WITH CHECK (receiver_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Habilitar real-time
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;