
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
CREATE TYPE payout_status AS ENUM (
    'pending',
    'approved', 
    'rejected',
    'paid'
);

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
  );
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
CREATE TABLE public.admin_setup (
    admin_user_id uuid NOT NULL,
    password_set boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (admin_user_id)
);

-- User profiles table
CREATE TABLE public.profiles (
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
CREATE TABLE public.driver_details (
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
CREATE TABLE public.pricing_settings (
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
CREATE TABLE public.locations (
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
CREATE TABLE public.rides (
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
CREATE TABLE public.ride_ratings (
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
CREATE TABLE public.driver_payout_requests (
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

-- Driver passenger ratings table (bidirectional rating system)
CREATE TABLE public.driver_passenger_ratings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ride_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    passenger_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT driver_passenger_ratings_rating_check CHECK ((rating >= 1) AND (rating <= 5)),
    CONSTRAINT driver_passenger_ratings_unique_ride_rating UNIQUE (ride_id, driver_id, passenger_id)
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
ALTER TABLE public.driver_passenger_ratings ENABLE ROW LEVEL SECURITY;

-- Admin setup policies
CREATE POLICY "Allow admin setup access" ON public.admin_setup
FOR ALL USING (true);

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.profiles
FOR UPDATE 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- Driver details policies
CREATE POLICY "Drivers can view own driver details" ON public.driver_details
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Drivers can insert own driver details" ON public.driver_details
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Drivers can update own driver details" ON public.driver_details
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all driver details" ON public.driver_details
FOR SELECT USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update any driver details" ON public.driver_details
FOR UPDATE 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Passengers can view driver details for their rides" ON public.driver_details
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM rides
        WHERE rides.driver_id = driver_details.user_id
        AND rides.passenger_id = auth.uid()
    )
);

-- Pricing settings policies
CREATE POLICY "Anyone can read pricing settings" ON public.pricing_settings
FOR SELECT USING (true);

CREATE POLICY "Only admins can insert pricing settings" ON public.pricing_settings
FOR INSERT WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Only admins can update pricing settings" ON public.pricing_settings
FOR UPDATE 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- Locations policies
CREATE POLICY "Users can manage own location" ON public.locations
FOR ALL USING (auth.uid() = user_id);

-- Rides policies
CREATE POLICY "Users can view rides they're involved in or admins can view all" ON public.rides
FOR SELECT USING (
    (auth.uid() = passenger_id) OR
    (auth.uid() = driver_id) OR
    (status = 'pending' AND public.get_current_user_role() = 'driver') OR
    (public.get_current_user_role() = 'admin')
);

CREATE POLICY "Passengers can create rides" ON public.rides
FOR INSERT WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Drivers can update accepted rides or admins can update any" ON public.rides
FOR UPDATE USING (
    (auth.uid() = driver_id) OR
    (driver_id IS NULL AND status = 'pending') OR
    (public.get_current_user_role() = 'admin')
);

CREATE POLICY "Passengers can cancel own pending rides" ON public.rides
FOR UPDATE 
USING (auth.uid() = passenger_id AND status = 'pending')
WITH CHECK (auth.uid() = passenger_id AND status IN ('pending', 'cancelled'));

-- Ride ratings policies
CREATE POLICY "Users can view ratings for rides they're involved in or admins" ON public.ride_ratings
FOR SELECT USING (
    (passenger_id = auth.uid()) OR
    (driver_id = auth.uid()) OR
    (public.get_current_user_role() = 'admin')
);

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

-- Driver payout requests policies
CREATE POLICY "Drivers can view own payout requests" ON public.driver_payout_requests
FOR SELECT USING (
    (auth.uid() = driver_id) OR
    (public.get_current_user_role() = 'admin')
);

CREATE POLICY "Drivers can create payout requests" ON public.driver_payout_requests
FOR INSERT WITH CHECK (
    (auth.uid() = driver_id) AND
    (public.get_current_user_role() = 'driver')
);

CREATE POLICY "Admins can update payout requests" ON public.driver_payout_requests
FOR UPDATE USING (public.get_current_user_role() = 'admin');

-- Driver passenger ratings policies
CREATE POLICY "Users can view ratings where they're involved or admins" ON public.driver_passenger_ratings
FOR SELECT USING (
    (driver_id = auth.uid()) OR
    (passenger_id = auth.uid()) OR
    (public.get_current_user_role() = 'admin')
);

CREATE POLICY "Drivers can rate passengers for their completed rides" ON public.driver_passenger_ratings
FOR INSERT WITH CHECK (
    (auth.uid() = driver_id) AND
    EXISTS (
        SELECT 1 FROM rides
        WHERE rides.id = driver_passenger_ratings.ride_id
        AND rides.driver_id = auth.uid()
        AND rides.passenger_id = driver_passenger_ratings.passenger_id
        AND rides.status = 'completed'
    )
);

CREATE POLICY "Admins can view all driver passenger ratings" ON public.driver_passenger_ratings
FOR SELECT USING (public.get_current_user_role() = 'admin');

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger to update updated_at timestamp on profiles
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to update updated_at timestamp on driver_details
CREATE TRIGGER set_updated_at_driver_details
    BEFORE UPDATE ON public.driver_details
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to update updated_at timestamp on pricing_settings
CREATE TRIGGER set_updated_at_pricing_settings
    BEFORE UPDATE ON public.pricing_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to update updated_at timestamp on rides
CREATE TRIGGER set_updated_at_rides
    BEFORE UPDATE ON public.rides
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to update updated_at timestamp on driver_payout_requests
CREATE TRIGGER set_updated_at_driver_payout_requests
    BEFORE UPDATE ON public.driver_payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to update updated_at timestamp on admin_setup
CREATE TRIGGER set_updated_at_admin_setup
    BEFORE UPDATE ON public.admin_setup
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to create profile when user signs up
-- NOTE: This trigger operates on auth.users which is managed by Supabase
-- It will only work if applied to a Supabase project with auth enabled
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for rides lookup by passenger
CREATE INDEX idx_rides_passenger_id ON public.rides(passenger_id);

-- Index for rides lookup by driver
CREATE INDEX idx_rides_driver_id ON public.rides(driver_id);

-- Index for rides lookup by status
CREATE INDEX idx_rides_status ON public.rides(status);

-- Index for locations lookup by user
CREATE INDEX idx_locations_user_id ON public.locations(user_id);

-- Index for locations lookup by timestamp
CREATE INDEX idx_locations_timestamp ON public.locations(timestamp DESC);

-- Index for driver details lookup by user
CREATE INDEX idx_driver_details_user_id ON public.driver_details(user_id);

-- Index for driver payout requests lookup by driver
CREATE INDEX idx_driver_payout_requests_driver_id ON public.driver_payout_requests(driver_id);

-- Index for driver payout requests lookup by status
CREATE INDEX idx_driver_payout_requests_status ON public.driver_payout_requests(status);

-- Index for ride ratings lookup by ride
CREATE INDEX idx_ride_ratings_ride_id ON public.ride_ratings(ride_id);

-- Index for ride ratings lookup by driver
CREATE INDEX idx_ride_ratings_driver_id ON public.ride_ratings(driver_id);

-- Index for driver passenger ratings lookup by ride
CREATE INDEX idx_driver_passenger_ratings_ride_id ON public.driver_passenger_ratings(ride_id);

-- Index for driver passenger ratings lookup by driver
CREATE INDEX idx_driver_passenger_ratings_driver_id ON public.driver_passenger_ratings(driver_id);

-- Index for driver passenger ratings lookup by passenger
CREATE INDEX idx_driver_passenger_ratings_passenger_id ON public.driver_passenger_ratings(passenger_id);

-- =============================================================================
-- REALTIME PUBLICATIONS
-- =============================================================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_payout_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_passenger_ratings;

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

-- Allow users to upload own avatars
CREATE POLICY "Users can upload own avatars" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update own avatars
CREATE POLICY "Users can update own avatars" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete own avatars
CREATE POLICY "Users can delete own avatars" ON storage.objects
FOR DELETE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public access to view avatars
CREATE POLICY "Public can view avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

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
COMMENT ON TABLE public.driver_passenger_ratings IS 'Driver ratings of passengers (bidirectional rating system)';
COMMENT ON TABLE public.admin_setup IS 'Admin setup configuration for initial system setup';

COMMENT ON COLUMN public.profiles.user_type IS 'User role: passenger, driver, or admin';
COMMENT ON COLUMN public.driver_details.vehicle_type IS 'Type of vehicle: car, motorcycle, bicycle';
COMMENT ON COLUMN public.pricing_settings.singleton IS 'Ensures only one pricing configuration exists';
COMMENT ON COLUMN public.pricing_settings.service_fee_type IS 'Service fee calculation method: fixed or percentage';
COMMENT ON COLUMN public.rides.status IS 'Ride status: pending, accepted, in_progress, completed, cancelled';
COMMENT ON COLUMN public.rides.payment_method IS 'Payment method: cash, pix, card';
COMMENT ON COLUMN public.ride_ratings.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN public.driver_passenger_ratings.rating IS 'Driver rating of passenger from 1 to 5 stars';
COMMENT ON COLUMN public.driver_payout_requests.payment_details IS 'JSON object containing payment method specific details';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify all tables exist
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('admin_setup', 'profiles', 'driver_details', 'pricing_settings', 'locations', 'rides', 'ride_ratings', 'driver_payout_requests', 'driver_passenger_ratings');
    
    IF table_count = 9 THEN
        RAISE NOTICE 'SUCCESS: All % tables created successfully', table_count;
    ELSE
        RAISE WARNING 'WARNING: Only % out of 9 tables were created', table_count;
    END IF;
END $$;

-- Verify all functions exist
DO $$
DECLARE
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO function_count 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN ('set_updated_at', 'handle_new_user', 'get_current_user_role');
    
    IF function_count = 3 THEN
        RAISE NOTICE 'SUCCESS: All % functions created successfully', function_count;
    ELSE
        RAISE WARNING 'WARNING: Only % out of 3 functions were created', function_count;
    END IF;
END $$;

-- Verify all triggers exist (except auth.users trigger which requires auth schema)
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
    
    IF trigger_count >= 6 THEN
        RAISE NOTICE 'SUCCESS: % triggers created successfully', trigger_count;
    ELSE
        RAISE WARNING 'WARNING: Only % triggers were created', trigger_count;
    END IF;
END $$;

-- Verify payout_status enum exists
DO $$
DECLARE
    enum_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'payout_status' 
        AND typtype = 'e'
    ) INTO enum_exists;
    
    IF enum_exists THEN
        RAISE NOTICE 'SUCCESS: payout_status enum created successfully';
    ELSE
        RAISE WARNING 'WARNING: payout_status enum was not created';
    END IF;
END $$;

-- Verify storage bucket exists
DO $$
DECLARE
    bucket_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM storage.buckets 
        WHERE id = 'avatars'
    ) INTO bucket_exists;
    
    IF bucket_exists THEN
        RAISE NOTICE 'SUCCESS: avatars storage bucket created successfully';
    ELSE
        RAISE WARNING 'WARNING: avatars storage bucket was not created';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE WARNING 'WARNING: storage.buckets table not found - this is normal for non-Supabase environments';
END $$;

-- =============================================================================
-- EDGE FUNCTIONS REQUIREMENTS
-- =============================================================================

-- The following Edge Functions are required for full functionality:
-- 
-- 1. get-google-maps-key
--    - Purpose: Returns Google Maps API key for frontend map functionality
--    - Required secret: GOOGLE_MAPS_API_KEY
--    - JWT verification: true
--
-- 2. places-autocomplete  
--    - Purpose: Provides address autocomplete functionality
--    - Required secret: GOOGLE_MAPS_API_KEY
--    - JWT verification: true
--
-- 3. place-details
--    - Purpose: Gets detailed information about selected places
--    - Required secret: GOOGLE_MAPS_API_KEY
--    - JWT verification: true
--
-- 4. calculate-route
--    - Purpose: Calculates routes between origin and destination
--    - Required secret: GOOGLE_MAPS_API_KEY
--    - JWT verification: true
--
-- 5. setup-admin
--    - Purpose: Initial admin user setup
--    - JWT verification: true
--
-- To configure these functions:
-- 1. Add GOOGLE_MAPS_API_KEY to Supabase secrets
-- 2. Deploy edge functions using Supabase CLI or ensure they exist in supabase/functions/
-- 3. All functions should have verify_jwt = true in supabase/config.toml

-- =============================================================================
-- AUTHENTICATION SETUP NOTES
-- =============================================================================

-- This project requires Supabase Auth to be properly configured:
--
-- 1. Email/Password authentication should be enabled
-- 2. The handle_new_user() trigger will automatically create profiles for new users
-- 3. User metadata should include:
--    - full_name: User's display name
--    - user_type: 'passenger', 'driver', or 'admin'
--    - phone: User's phone number (optional)
--
-- 4. For the first admin setup:
--    - A user should sign up normally
--    - Use the setup-admin edge function to promote them to admin
--    - Update the admin_setup table with their user ID

-- =============================================================================
-- ROW LEVEL SECURITY NOTES
-- =============================================================================

-- Important RLS considerations:
--
-- 1. The get_current_user_role() function uses SECURITY DEFINER to prevent
--    infinite recursion in RLS policies
--
-- 2. All policies are designed to:
--    - Allow users to access their own data
--    - Allow admins to access all data
--    - Allow drivers to see pending rides for pickup
--    - Allow passengers to rate completed rides only
--
-- 3. If you encounter RLS errors:
--    - Ensure users are properly authenticated
--    - Check that user_type is correctly set in profiles table
--    - Verify the get_current_user_role() function is working

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

-- This backup file contains all necessary components to recreate the project database:
-- ✓ Extensions (uuid-ossp, pgcrypto)
-- ✓ Custom types (payout_status enum)
-- ✓ Functions (set_updated_at, handle_new_user, get_current_user_role)
-- ✓ Tables (9 tables including bidirectional rating system with driver_passenger_ratings)
-- ✓ Row Level Security policies (using security definer functions to prevent recursion)
-- ✓ Triggers (including auth.users trigger for profile creation)
-- ✓ Performance indexes
-- ✓ Realtime publications for live updates
-- ✓ Storage buckets and policies for avatars
-- ✓ Seed data for admin setup and pricing settings
-- ✓ Documentation comments
-- ✓ Verification queries to check migration success
-- ✓ Edge functions and authentication setup documentation

-- MIGRATION CHECKLIST:
-- □ Run this SQL script on target database
-- □ Verify all verification queries pass
-- □ Configure required Edge Functions
-- □ Add GOOGLE_MAPS_API_KEY secret
-- □ Test authentication flow
-- □ Setup first admin user
-- □ Test ride creation and driver assignment
-- □ Verify real-time updates are working

SELECT 'Database backup restoration completed successfully! Check verification messages above.' AS status;
