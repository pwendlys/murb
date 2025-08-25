-- Criar enum para status de assinatura
CREATE TYPE subscription_status AS ENUM ('ativa', 'vencida', 'renovacao_solicitada', 'bloqueada');

-- Criar tabela de planos de assinatura
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- 'meia' ou 'completa'
  duration_days INTEGER NOT NULL, -- 15 ou 30
  price_cents INTEGER NOT NULL, -- 17500 ou 35000
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir planos padrão
INSERT INTO public.subscription_plans (name, duration_days, price_cents) VALUES
('meia', 15, 17500),
('completa', 30, 35000);

-- Criar tabela de assinaturas dos motoristas
CREATE TABLE public.driver_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status DEFAULT 'ativa',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de solicitações de renovação
CREATE TABLE public.subscription_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  current_subscription_id UUID REFERENCES public.driver_subscriptions(id),
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  admin_notes TEXT
);

-- Habilitar RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para subscription_plans
CREATE POLICY "Everyone can view active subscription plans" 
ON public.subscription_plans 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans" 
ON public.subscription_plans 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
));

-- Políticas RLS para driver_subscriptions
CREATE POLICY "Drivers can view their own subscriptions" 
ON public.driver_subscriptions 
FOR SELECT 
USING (driver_id = auth.uid());

CREATE POLICY "Admins can view all driver subscriptions" 
ON public.driver_subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
));

CREATE POLICY "System can manage driver subscriptions" 
ON public.driver_subscriptions 
FOR ALL 
USING (true);

-- Políticas RLS para subscription_requests
CREATE POLICY "Drivers can create and view their own subscription requests" 
ON public.subscription_requests 
FOR ALL 
USING (driver_id = auth.uid());

CREATE POLICY "Admins can view and manage all subscription requests" 
ON public.subscription_requests 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
));

-- Função para solicitar renovação de assinatura
CREATE OR REPLACE FUNCTION public.request_subscription_renewal(p_plan_id UUID)
RETURNS subscription_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver_id UUID;
  v_current_subscription RECORD;
  v_plan RECORD;
  v_request RECORD;
BEGIN
  -- Verificar autenticação
  v_driver_id := auth.uid();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verificar se é motorista
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_driver_id AND user_type = 'driver') THEN
    RAISE EXCEPTION 'not_a_driver';
  END IF;

  -- Verificar se já tem solicitação pendente
  IF EXISTS (
    SELECT 1 FROM public.subscription_requests
    WHERE driver_id = v_driver_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'pending_request_exists';
  END IF;

  -- Buscar plano
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_plan_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  -- Buscar assinatura atual (se houver)
  SELECT * INTO v_current_subscription
  FROM public.driver_subscriptions
  WHERE driver_id = v_driver_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Criar solicitação
  INSERT INTO public.subscription_requests (
    driver_id,
    plan_id,
    current_subscription_id,
    status
  ) VALUES (
    v_driver_id,
    p_plan_id,
    v_current_subscription.id,
    'pending'
  ) RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

-- Função para aprovar pagamento e ativar assinatura
CREATE OR REPLACE FUNCTION public.approve_subscription_payment(p_request_id UUID)
RETURNS driver_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id UUID;
  v_request RECORD;
  v_plan RECORD;
  v_current_subscription RECORD;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_new_subscription RECORD;
BEGIN
  -- Verificar autenticação admin
  v_admin_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND user_type = 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Buscar solicitação
  SELECT * INTO v_request
  FROM public.subscription_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'invalid_request_status';
  END IF;

  -- Buscar plano
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_request.plan_id;

  -- Buscar assinatura atual (se houver)
  SELECT * INTO v_current_subscription
  FROM public.driver_subscriptions
  WHERE driver_id = v_request.driver_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Calcular datas
  IF v_current_subscription.id IS NOT NULL AND v_current_subscription.end_date > NOW() THEN
    -- Renovação antecipada: soma ao final do período atual
    v_start_date := v_current_subscription.end_date;
    v_end_date := v_current_subscription.end_date + (v_plan.duration_days || ' days')::interval;
  ELSE
    -- Nova assinatura ou assinatura vencida
    v_start_date := NOW();
    v_end_date := NOW() + (v_plan.duration_days || ' days')::interval;
  END IF;

  -- Criar nova assinatura
  INSERT INTO public.driver_subscriptions (
    driver_id,
    plan_id,
    status,
    start_date,
    end_date
  ) VALUES (
    v_request.driver_id,
    v_request.plan_id,
    'ativa',
    v_start_date,
    v_end_date
  ) RETURNING * INTO v_new_subscription;

  -- Atualizar solicitação
  UPDATE public.subscription_requests
  SET 
    status = 'approved',
    processed_at = NOW(),
    processed_by = v_admin_id
  WHERE id = p_request_id;

  -- Marcar assinatura anterior como inativa (se houver)
  IF v_current_subscription.id IS NOT NULL THEN
    UPDATE public.driver_subscriptions
    SET status = 'vencida'
    WHERE id = v_current_subscription.id;
  END IF;

  RETURN v_new_subscription;
END;
$$;

-- Função para verificar status da assinatura
CREATE OR REPLACE FUNCTION public.get_driver_subscription_status(p_driver_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_name TEXT,
  duration_days INTEGER,
  price_cents INTEGER,
  status subscription_status,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  days_remaining INTEGER,
  has_pending_request BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id as subscription_id,
    sp.name as plan_name,
    sp.duration_days,
    sp.price_cents,
    CASE 
      WHEN ds.end_date < NOW() THEN 'vencida'::subscription_status
      ELSE ds.status
    END as status,
    ds.start_date,
    ds.end_date,
    GREATEST(0, EXTRACT(DAY FROM ds.end_date - NOW())::INTEGER) as days_remaining,
    EXISTS(
      SELECT 1 FROM public.subscription_requests sr 
      WHERE sr.driver_id = p_driver_id AND sr.status = 'pending'
    ) as has_pending_request
  FROM public.driver_subscriptions ds
  JOIN public.subscription_plans sp ON sp.id = ds.plan_id
  WHERE ds.driver_id = p_driver_id
  ORDER BY ds.created_at DESC
  LIMIT 1;
END;
$$;

-- Criar triggers para updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_driver_subscriptions_updated_at
BEFORE UPDATE ON public.driver_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();