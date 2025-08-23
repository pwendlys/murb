-- Adicionar campos para rastrear saldo anterior e valor da taxa na tabela fee_payments
ALTER TABLE public.fee_payments 
ADD COLUMN available_balance_before numeric(14,2) DEFAULT 0,
ADD COLUMN actual_fee_amount numeric(14,2) DEFAULT 0;

-- Atualizar registros existentes com valores padrão baseados no amount atual
UPDATE public.fee_payments 
SET actual_fee_amount = amount 
WHERE actual_fee_amount = 0;

-- Comentar para documentar os novos campos:
-- available_balance_before: saldo disponível antes da solicitação
-- actual_fee_amount: valor real da taxa calculada