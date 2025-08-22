
-- Project Database Backup SQL
-- This file contains all necessary SQL to recreate the project database
-- Generated for ride-sharing platform with driver earnings management

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for additional cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CUSTOM TYPES
-- =============================================================================

-- Payout status enumeration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE payout_status AS ENUM (
        'pending',
        'approved', 
        'rejected',
        'paid'
    );
  END IF;
END $$;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function to handle new user registration and create profile
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
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'passenger'),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'user_type', 'passenger') = 'driver' THEN false
      ELSE true
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Security definer function to get current user role (prevents RLS infinite recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $function$
  SELECT user_type FROM public.profiles WHERE id = auth.uid();
$function$;

-- =============================================================================
-- TABLES
-- =============================================================================

-- Admin setup table for initial admin configuration
CREATE TABLE IF NOT EXISTS public.admin_setup (
    admin_user_id uuid NOT NULL,
    password_set boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (admin_user_id)
);

-- User profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    phone text,
    user_type text NOT NULL,
    avatar_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Driver details table for vehicle and license information
CREATE TABLE IF NOT EXISTS public.driver_details (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    vehicle_brand text,
    vehicle_model text,
    vehicle_plate text,
    vehicle_color text,
    vehicle_type text NOT NULL DEFAULT 'car',
    driver_license text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Pricing settings table (singleton pattern)
CREATE TABLE IF NOT EXISTS public.pricing_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    singleton boolean NOT NULL DEFAULT true,
    price_per_km_active boolean NOT NULL DEFAULT true,
    price_per_km numeric NOT NULL DEFAULT 2.5,
    fixed_price_active boolean NOT NULL DEFAULT false,
    fixed_price numeric,
    service_fee_type text NOT NULL DEFAULT 'fixed',
    service_fee_value numeric NOT NULL DEFAULT 0,
    updated_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (singleton)
);

-- User locations table for real-time tracking
CREATE TABLE IF NOT EXISTS public.locations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    heading double precision,
    speed double precision,
    timestamp timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Rides table for managing ride requests and history
CREATE TABLE IF NOT EXISTS public.rides (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    passenger_id uuid NOT NULL,
    driver_id uuid,
    origin_address text NOT NULL,
    destination_address text NOT NULL,
    origin_lat double precision NOT NULL,
    origin_lng double precision NOT NULL,
    destination_lat double precision NOT NULL,
    destination_lng double precision NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    estimated_duration integer,
    estimated_distance double precision,
    estimated_price numeric,
    actual_price numeric,
    payment_method text,
    driver_en_route boolean DEFAULT false,
    driver_arrived boolean DEFAULT false,
    en_route_started_at timestamp with time zone,
    pickup_arrived_at timestamp with time zone,
    driver_to_pickup_distance_km numeric,
    driver_to_pickup_duration_min integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Ride ratings table for passenger feedback
CREATE TABLE IF NOT EXISTS public.ride_ratings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ride_id uuid NOT NULL,
    passenger_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Driver payout requests table
CREATE TABLE IF NOT EXISTS public.driver_payout_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    driver_id uuid NOT NULL,
    amount numeric NOT NULL,
    status payout_status NOT NULL DEFAULT 'pending',
    payment_method text NOT NULL,
    payment_details jsonb,
    notes text,
    admin_notes text,
    processed_by uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.admin_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;

-- Admin setup policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_setup' AND policyname='Allow admin setup access'
  ) THEN
    CREATE POLICY "Allow admin setup access" ON public.admin_setup
    FOR ALL USING (true);
  END IF;
END $$;

-- Profiles policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can view all profiles') THEN
    CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can update any profile') THEN
    CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE 
    USING (public.get_current_user_role() = 'admin')
    WITH CHECK (public.get_current_user_role() = 'admin');
  END IF;
END $$;

-- Driver details policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_details' AND policyname='Drivers can view own driver details') THEN
    CREATE POLICY "Drivers can view own driver details" ON public.driver_details
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_details' AND policyname='Drivers can insert own driver details') THEN
    CREATE POLICY "Drivers can insert own driver details" ON public.driver_details
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_details' AND policyname='Drivers can update own driver details') THEN
    CREATE POLICY "Drivers can update own driver details" ON public.driver_details
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_details' AND policyname='Admins can view all driver details') THEN
    CREATE POLICY "Admins can view all driver details" ON public.driver_details
    FOR SELECT USING (public.get_current_user_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_details' AND policyname='Admins can update any driver details') THEN
    CREATE POLICY "Admins can update any driver details" ON public.driver_details
    FOR UPDATE 
    USING (public.get_current_user_role() = 'admin')
    WITH CHECK (public.get_current_user_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_details' AND policyname='Passengers can view driver details for their rides') THEN
    CREATE POLICY "Passengers can view driver details for their rides" ON public.driver_details
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM rides
            WHERE rides.driver_id = driver_details.user_id
            AND rides.passenger_id = auth.uid()
        )
    );
  END IF;
END $$;

-- Pricing settings policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_settings' AND policyname='Anyone can read pricing settings') THEN
    CREATE POLICY "Anyone can read pricing settings" ON public.pricing_settings
    FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_settings' AND policyname='Only admins can insert pricing settings') THEN
    CREATE POLICY "Only admins can insert pricing settings" ON public.pricing_settings
    FOR INSERT WITH CHECK (public.get_current_user_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_settings' AND policyname='Only admins can update pricing settings') THEN
    CREATE POLICY "Only admins can update pricing settings" ON public.pricing_settings
    FOR UPDATE 
    USING (public.get_current_user_role() = 'admin')
    WITH CHECK (public.get_current_user_role() = 'admin');
  END IF;
END $$;

-- Locations policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='locations' AND policyname='Users can manage own location') THEN
    CREATE POLICY "Users can manage own location" ON public.locations
    FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Rides policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rides' AND policyname='Users can view rides they''re involved in or admins can view all') THEN
    CREATE POLICY "Users can view rides they're involved in or admins can view all" ON public.rides
    FOR SELECT USING (
        (auth.uid() = passenger_id) OR
        (auth.uid() = driver_id) OR
        (status = 'pending' AND public.get_current_user_role() = 'driver') OR
        (public.get_current_user_role() = 'admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rides' AND policyname='Passengers can create rides') THEN
    CREATE POLICY "Passengers can create rides" ON public.rides
    FOR INSERT WITH CHECK (auth.uid() = passenger_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rides' AND policyname='Drivers can update accepted rides or admins can update any') THEN
    CREATE POLICY "Drivers can update accepted rides or admins can update any" ON public.rides
    FOR UPDATE USING (
        (auth.uid() = driver_id) OR
        (driver_id IS NULL AND status = 'pending') OR
        (public.get_current_user_role() = 'admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rides' AND policyname='Passengers can cancel own pending rides') THEN
    CREATE POLICY "Passengers can cancel own pending rides" ON public.rides
    FOR UPDATE 
    USING (auth.uid() = passenger_id AND status = 'pending')
    WITH CHECK (auth.uid() = passenger_id AND status IN ('pending', 'cancelled'));
  END IF;
END $$;

-- Ride ratings policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ride_ratings' AND policyname='Users can view ratings for rides they''re involved in or admins') THEN
    CREATE POLICY "Users can view ratings for rides they're involved in or admins" ON public.ride_ratings
    FOR SELECT USING (
        (passenger_id = auth.uid()) OR
        (driver_id = auth.uid()) OR
        (public.get_current_user_role() = 'admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ride_ratings' AND policyname='Passengers can rate completed rides') THEN
    CREATE POLICY "Passengers can rate completed rides" ON public.ride_ratings
    FOR INSERT WITH CHECK (
        passenger_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM rides
            WHERE rides.id = ride_ratings.ride_id
            AND rides.passenger_id = auth.uid()
            AND rides.status = 'completed'
            AND rides.driver_id = ride_ratings.driver_id
        )
    );
  END IF;
END $$;

-- Driver payout requests policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_payout_requests' AND policyname='Drivers can view own payout requests') THEN
    CREATE POLICY "Drivers can view own payout requests" ON public.driver_payout_requests
    FOR SELECT USING (
        (auth.uid() = driver_id) OR
        (public.get_current_user_role() = 'admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_payout_requests' AND policyname='Drivers can create payout requests') THEN
    CREATE POLICY "Drivers can create payout requests" ON public.driver_payout_requests
    FOR INSERT WITH CHECK (
        (auth.uid() = driver_id) AND
        (public.get_current_user_role() = 'driver')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_payout_requests' AND policyname='Admins can update payout requests') THEN
    CREATE POLICY "Admins can update payout requests" ON public.driver_payout_requests
    FOR UPDATE USING (public.get_current_user_role() = 'admin');
  END IF;
END $$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger to update updated_at timestamp on profiles
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to update updated_at timestamp on driver_details
DROP TRIGGER IF EXISTS set_updated_at_driver_details ON public.driver_details;
CREATE TRIGGER set_updated_at_driver_details
    BEFORE UPDATE ON public.driver_details
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to update updated_at timestamp on pricing_settings
DROP TRIGGER IF EXISTS set_updated_at_pricing_settings ON public.pricing_settings;
CREATE TRIGGER set_updated_at_pricing_settings
    BEFORE UPDATE ON public.pricing_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to update updated_at timestamp on rides
DROP TRIGGER IF EXISTS set_updated_at_rides ON public.rides;
CREATE TRIGGER set_updated_at_rides
    BEFORE UPDATE ON public.rides
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to update updated_at timestamp on driver_payout_requests
DROP TRIGGER IF EXISTS set_updated_at_driver_payout_requests ON public.driver_payout_requests;
CREATE TRIGGER set_updated_at_driver_payout_requests
    BEFORE UPDATE ON public.driver_payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to create profile when user signs up
-- NOTE: This attaches to Supabase auth.users so profiles are auto-created on signup.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for rides lookup by passenger
CREATE INDEX IF NOT EXISTS idx_rides_passenger_id ON public.rides(passenger_id);

-- Index for rides lookup by driver
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides(driver_id);

-- Index for rides lookup by status
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);

-- Index for locations lookup by user
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON public.locations(user_id);

-- Index for locations lookup by timestamp
CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON public.locations(timestamp DESC);

-- Index for driver details lookup by user
CREATE INDEX IF NOT EXISTS idx_driver_details_user_id ON public.driver_details(user_id);

-- Index for driver payout requests lookup by driver
CREATE INDEX IF NOT EXISTS idx_driver_payout_requests_driver_id ON public.driver_payout_requests(driver_id);

-- Index for driver payout requests lookup by status
CREATE INDEX IF NOT EXISTS idx_driver_payout_requests_status ON public.driver_payout_requests(status);

-- Index for ride ratings lookup by ride
CREATE INDEX IF NOT EXISTS idx_ride_ratings_ride_id ON public.ride_ratings(ride_id);

-- Index for ride ratings lookup by driver
CREATE INDEX IF NOT EXISTS idx_ride_ratings_driver_id ON public.ride_ratings(driver_id);

-- =============================================================================
-- REALTIME PUBLICATIONS
-- =============================================================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_payout_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_ratings;

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Insert minimal admin_setup record to work with setup-admin edge function
-- This creates a placeholder record that the setup-admin function can update
INSERT INTO public.admin_setup (admin_user_id, password_set)
VALUES ('00000000-0000-0000-0000-000000000000', false)
ON CONFLICT (admin_user_id) DO NOTHING;

-- Insert default pricing settings
INSERT INTO public.pricing_settings (
    singleton,
    price_per_km_active,
    price_per_km,
    fixed_price_active,
    fixed_price,
    service_fee_type,
    service_fee_value
) VALUES (
    true,
    true,
    2.5,
    false,
    NULL,
    'fixed',
    0
) ON CONFLICT (singleton) DO NOTHING;

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

-- Create avatars bucket for user profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STORAGE POLICIES
-- =============================================================================

-- Allow users to upload their own avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload own avatars'
  ) THEN
    CREATE POLICY "Users can upload own avatars" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Allow users to update their own avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update own avatars'
  ) THEN
    CREATE POLICY "Users can update own avatars" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Allow users to delete their own avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete own avatars'
  ) THEN
    CREATE POLICY "Users can delete own avatars" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Allow public access to view avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public can view avatars'
  ) THEN
    CREATE POLICY "Public can view avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END $$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

-- Add helpful comments for documentation
COMMENT ON TABLE public.profiles IS 'User profile information for all user types (passenger, driver, admin)';
COMMENT ON TABLE public.driver_details IS 'Vehicle and license information for drivers';
COMMENT ON TABLE public.pricing_settings IS 'Global pricing configuration (singleton pattern)';
COMMENT ON TABLE public.locations IS 'Real-time location tracking for drivers';
COMMENT ON TABLE public.rides IS 'Ride requests and history with payment methods';
COMMENT ON TABLE public.ride_ratings IS 'Passenger ratings and feedback for completed rides';
COMMENT ON TABLE public.driver_payout_requests IS 'Driver withdrawal requests and payment processing';
COMMENT ON TABLE public.admin_setup IS 'Admin setup configuration for initial system setup';

COMMENT ON COLUMN public.profiles.user_type IS 'User role: passenger, driver, or admin';
COMMENT ON COLUMN public.driver_details.vehicle_type IS 'Type of vehicle: car, motorcycle, bicycle';
COMMENT ON COLUMN public.pricing_settings.singleton IS 'Ensures only one pricing configuration exists';
COMMENT ON COLUMN public.pricing_settings.service_fee_type IS 'Service fee calculation method: fixed or percentage';
COMMENT ON COLUMN public.rides.status IS 'Ride status: pending, accepted, in_progress, completed, cancelled';
COMMENT ON COLUMN public.rides.payment_method IS 'Payment method: cash, pix, card';
COMMENT ON COLUMN public.ride_ratings.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN public.driver_payout_requests.payment_details IS 'JSON object containing payment method specific details';

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

SELECT 'Database backup restoration completed successfully!' AS status;
