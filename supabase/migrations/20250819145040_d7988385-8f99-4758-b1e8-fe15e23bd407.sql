
-- Ensure admin_setup table has the correct record
INSERT INTO public.admin_setup (admin_user_id, password_set)
VALUES ('00000000-0000-0000-0000-000000000001', false)
ON CONFLICT (admin_user_id) DO UPDATE SET
  password_set = false,
  updated_at = now();
