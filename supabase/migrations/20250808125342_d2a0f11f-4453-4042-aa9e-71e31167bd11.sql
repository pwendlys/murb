
-- Criar a conta admin específica com email fixo
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@ridebuddy.com',
  '', -- Senha vazia inicialmente
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Administrador", "user_type": "admin"}',
  false,
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

-- Criar o perfil admin
INSERT INTO public.profiles (
  id,
  full_name,
  user_type,
  is_active,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Administrador',
  'admin',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Criar uma tabela para controlar o primeiro login do admin
CREATE TABLE IF NOT EXISTS public.admin_setup (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  password_set boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(admin_user_id)
);

-- Inserir registro para controle do primeiro login
INSERT INTO public.admin_setup (admin_user_id, password_set)
VALUES ('00000000-0000-0000-0000-000000000001', false)
ON CONFLICT (admin_user_id) DO NOTHING;

-- Habilitar RLS na tabela admin_setup
ALTER TABLE public.admin_setup ENABLE ROW LEVEL SECURITY;

-- Política para que apenas o admin possa acessar seus próprios dados
CREATE POLICY "Admin can manage own setup" ON public.admin_setup
  FOR ALL USING (auth.uid() = admin_user_id);
