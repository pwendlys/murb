
-- Permitir 'admin' como valor válido em profiles.user_type
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('passenger', 'driver', 'admin'));
