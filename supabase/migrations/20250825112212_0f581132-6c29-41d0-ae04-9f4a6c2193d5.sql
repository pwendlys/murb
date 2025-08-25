-- Adicionar apenas as foreign keys que faltam (verificando se existem primeiro)

-- Verificar e adicionar foreign key para subscription_requests.driver_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'subscription_requests_driver_id_fkey' 
                   AND table_name = 'subscription_requests') THEN
        ALTER TABLE public.subscription_requests 
        ADD CONSTRAINT subscription_requests_driver_id_fkey 
        FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Verificar e adicionar foreign key para driver_subscriptions.driver_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'driver_subscriptions_driver_id_fkey' 
                   AND table_name = 'driver_subscriptions') THEN
        ALTER TABLE public.driver_subscriptions 
        ADD CONSTRAINT driver_subscriptions_driver_id_fkey 
        FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Verificar e adicionar foreign key para driver_subscriptions.plan_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'driver_subscriptions_plan_id_fkey' 
                   AND table_name = 'driver_subscriptions') THEN
        ALTER TABLE public.driver_subscriptions 
        ADD CONSTRAINT driver_subscriptions_plan_id_fkey 
        FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE CASCADE;
    END IF;
END $$;