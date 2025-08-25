-- Adicionar foreign keys faltantes para corrigir problemas de join

-- Foreign keys para subscription_requests
ALTER TABLE public.subscription_requests 
ADD CONSTRAINT subscription_requests_driver_id_fkey 
FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.subscription_requests 
ADD CONSTRAINT subscription_requests_plan_id_fkey 
FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE CASCADE;

-- Foreign keys para driver_subscriptions
ALTER TABLE public.driver_subscriptions 
ADD CONSTRAINT driver_subscriptions_driver_id_fkey 
FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.driver_subscriptions 
ADD CONSTRAINT driver_subscriptions_plan_id_fkey 
FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE CASCADE;