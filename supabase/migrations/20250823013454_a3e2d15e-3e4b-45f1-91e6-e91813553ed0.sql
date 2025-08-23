-- Corrigir última função sem search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, user_type, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'passenger'),
    -- Mototaxistas precisam ser aprovados, então começam inativos
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'user_type', 'passenger') = 'driver' THEN FALSE
      ELSE TRUE
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;