
-- Create the admin_setup table to track admin password configuration
CREATE TABLE public.admin_setup (
  admin_user_id UUID PRIMARY KEY,
  password_set BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert the default admin setup record
INSERT INTO public.admin_setup (admin_user_id, password_set) 
VALUES ('00000000-0000-0000-0000-000000000001', FALSE);

-- Create the admin user in auth.users if it doesn't exist
-- This will be handled by the application code since we can't directly insert into auth.users

-- Enable RLS on admin_setup table
ALTER TABLE public.admin_setup ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows access to admin_setup table
-- Since this is for admin functionality, we'll allow access but this should be restricted in production
CREATE POLICY "Allow admin setup access" ON public.admin_setup FOR ALL USING (true);
