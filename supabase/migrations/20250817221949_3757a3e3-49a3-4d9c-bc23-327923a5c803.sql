-- Create driver_passenger_ratings table for bidirectional rating system
CREATE TABLE public.driver_passenger_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  passenger_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ride_id, driver_id, passenger_id)
);

-- Enable Row Level Security
ALTER TABLE public.driver_passenger_ratings ENABLE ROW LEVEL SECURITY;

-- Create policies for driver_passenger_ratings
CREATE POLICY "Drivers can rate passengers for their completed rides" 
ON public.driver_passenger_ratings 
FOR INSERT 
WITH CHECK (
  auth.uid() = driver_id AND 
  EXISTS (
    SELECT 1 FROM rides 
    WHERE rides.id = driver_passenger_ratings.ride_id 
    AND rides.driver_id = auth.uid() 
    AND rides.passenger_id = driver_passenger_ratings.passenger_id 
    AND rides.status = 'completed'
  )
);

CREATE POLICY "Users can view ratings where they're involved or admins" 
ON public.driver_passenger_ratings 
FOR SELECT 
USING (
  driver_id = auth.uid() OR 
  passenger_id = auth.uid() OR 
  get_current_user_role() = 'admin'
);

CREATE POLICY "Admins can view all driver passenger ratings" 
ON public.driver_passenger_ratings 
FOR SELECT 
USING (get_current_user_role() = 'admin');