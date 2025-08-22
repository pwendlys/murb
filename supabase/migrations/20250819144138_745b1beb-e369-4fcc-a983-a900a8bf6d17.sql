
-- Update the handle_new_user function to properly read user_type from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, user_type, phone, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE 
      WHEN NEW.raw_user_meta_data->>'user_type' IN ('passenger', 'driver', 'admin') 
      THEN NEW.raw_user_meta_data->>'user_type' 
      ELSE 'passenger' 
    END,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'user_type', 'passenger') = 'driver' THEN false
      ELSE true
    END
  );
  RETURN NEW;
END;
$function$;

-- Backfill existing profiles that should be drivers
-- This will look at the auth.users metadata to correct profiles that were wrongly set as passenger
UPDATE public.profiles 
SET user_type = 'driver',
    is_active = false
FROM auth.users 
WHERE profiles.id = users.id 
  AND profiles.user_type = 'passenger'
  AND users.raw_user_meta_data->>'user_type' = 'driver';

-- Also update full_name and phone for existing profiles if they're missing
UPDATE public.profiles 
SET full_name = COALESCE(users.raw_user_meta_data->>'full_name', users.email),
    phone = NULLIF(users.raw_user_meta_data->>'phone', '')
FROM auth.users 
WHERE profiles.id = users.id 
  AND (profiles.full_name IS NULL OR profiles.full_name = '' OR profiles.phone IS NULL);
