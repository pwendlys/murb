
-- Add foreign key constraints to establish relationships between rides and profiles tables
ALTER TABLE public.rides 
ADD CONSTRAINT rides_passenger_id_fkey 
FOREIGN KEY (passenger_id) REFERENCES public.profiles(id);

ALTER TABLE public.rides 
ADD CONSTRAINT rides_driver_id_fkey 
FOREIGN KEY (driver_id) REFERENCES public.profiles(id);
