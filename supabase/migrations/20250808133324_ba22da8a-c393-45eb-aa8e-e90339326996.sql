
-- Update RLS policies for rides table to allow admin access

-- First, let's drop the existing policies
DROP POLICY IF EXISTS "Users can view rides they're involved in" ON public.rides;
DROP POLICY IF EXISTS "Drivers can update rides they accepted" ON public.rides;

-- Create new policies that include admin access

-- Allow users to view rides they're involved in OR allow admins to view all rides
CREATE POLICY "Users can view rides they're involved in or admins can view all" 
ON public.rides 
FOR SELECT 
USING (
  (auth.uid() = passenger_id) OR 
  (auth.uid() = driver_id) OR 
  ((status = 'pending') AND (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.user_type = 'driver'
  ))) OR
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
  ))
);

-- Allow drivers to update rides they accepted OR allow admins to update any ride
CREATE POLICY "Drivers can update accepted rides or admins can update any" 
ON public.rides 
FOR UPDATE 
USING (
  (auth.uid() = driver_id) OR 
  ((driver_id IS NULL) AND (status = 'pending')) OR
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
  ))
);
