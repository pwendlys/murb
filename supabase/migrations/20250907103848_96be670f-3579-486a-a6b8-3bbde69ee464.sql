-- Habilitar extensão pg_cron se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Criar função inserir_3x_e_parar (sobrescrever se existir)
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

-- Remover cron job existente se houver
SELECT cron.unschedule('projetoAtivo');

-- Agendar cron job projetoAtivo (executa a cada 5 dias às 00:00)
SELECT cron.schedule(
  'projetoAtivo',
  '0 0 */5 * *',
  'SELECT inserir_3x_e_parar();'
);