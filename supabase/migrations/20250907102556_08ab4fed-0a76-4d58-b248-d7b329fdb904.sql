-- Habilitar extensão pg_cron se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Criar tabela bd_ativo
CREATE TABLE public.bd_ativo (
    id SERIAL PRIMARY KEY,
    num INT8 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela
ALTER TABLE public.bd_ativo ENABLE ROW LEVEL SECURITY;

-- Criar política para admins visualizarem todos os registros
CREATE POLICY "Admins can view all bd_ativo records" 
ON public.bd_ativo 
FOR SELECT 
USING (EXISTS ( 
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
));

-- Criar política para o sistema inserir registros
CREATE POLICY "System can insert bd_ativo records" 
ON public.bd_ativo 
FOR INSERT 
WITH CHECK (true);

-- Criar função inserir_3x_e_parar
CREATE OR REPLACE FUNCTION inserir_3x_e_parar()
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INT := 0;
BEGIN
  WHILE i < 3 LOOP
    INSERT INTO bd_ativo(num) VALUES (1);
    i := i + 1;
    IF i < 3 THEN
      PERFORM pg_sleep(5);
    END IF;
  END LOOP;
END;
$$;

-- Agendar cron job projetoAtivo (executa a cada 5 dias às 00:00)
SELECT cron.schedule(
  'projetoAtivo',
  '0 0 */5 * *',
  'SELECT inserir_3x_e_parar();'
);