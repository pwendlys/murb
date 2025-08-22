
-- Create ride_ratings table for passenger ratings of drivers
CREATE TABLE public.ride_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL UNIQUE REFERENCES public.rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_ride_ratings_passenger_id ON public.ride_ratings(passenger_id);
CREATE INDEX idx_ride_ratings_driver_id ON public.ride_ratings(driver_id);

-- RLS Policies
-- Allow passengers and drivers involved in the ride to view ratings, plus admins
CREATE POLICY "Users can view ratings for rides they're involved in or admins can view all" 
ON public.ride_ratings 
FOR SELECT 
USING (
  passenger_id = auth.uid() 
  OR driver_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- Only the passenger can rate their completed ride
CREATE POLICY "Passengers can rate completed rides" 
ON public.ride_ratings 
FOR INSERT 
WITH CHECK (
  passenger_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM rides 
    WHERE id = ride_id 
    AND passenger_id = auth.uid() 
    AND status = 'completed'
    AND driver_id = ride_ratings.driver_id
  )
);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER set_ride_ratings_updated_at
  BEFORE UPDATE ON public.ride_ratings
  FOR EACH ROW
  EXECUTE function public.set_updated_at();
