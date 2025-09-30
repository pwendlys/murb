-- Add missing foreign keys for driver_subscriptions and subscription_requests

-- Add foreign key from driver_subscriptions to profiles
ALTER TABLE public.driver_subscriptions
ADD CONSTRAINT driver_subscriptions_driver_id_fkey
FOREIGN KEY (driver_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Add foreign key from subscription_requests to profiles
ALTER TABLE public.subscription_requests
ADD CONSTRAINT subscription_requests_driver_id_fkey
FOREIGN KEY (driver_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;