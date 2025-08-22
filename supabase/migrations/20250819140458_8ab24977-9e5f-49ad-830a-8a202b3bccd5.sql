
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create custom types
CREATE TYPE public.payout_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    user_type TEXT NOT NULL CHECK (user_type IN ('passenger', 'driver', 'admin')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admin_setup table
CREATE TABLE public.admin_setup (
    admin_user_id UUID PRIMARY KEY,
    password_set BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create driver_details table
CREATE TABLE public.driver_details (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    vehicle_type TEXT DEFAULT 'car',
    vehicle_brand TEXT,
    vehicle_model TEXT,
    vehicle_color TEXT,
    vehicle_plate TEXT,
    driver_license TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create locations table
CREATE TABLE public.locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create rides table
CREATE TABLE public.rides (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    origin_address TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    origin_lat DOUBLE PRECISION NOT NULL,
    origin_lng DOUBLE PRECISION NOT NULL,
    destination_lat DOUBLE PRECISION NOT NULL,
    destination_lng DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
    estimated_duration INTEGER,
    estimated_distance DOUBLE PRECISION,
    estimated_price DECIMAL(10,2),
    actual_price DECIMAL(10,2),
    payment_method TEXT,
    driver_en_route BOOLEAN DEFAULT false,
    en_route_started_at TIMESTAMPTZ,
    driver_to_pickup_distance_km DOUBLE PRECISION,
    driver_to_pickup_duration_min INTEGER,
    driver_arrived BOOLEAN DEFAULT false,
    pickup_arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pricing_settings table
CREATE TABLE public.pricing_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    singleton BOOLEAN DEFAULT true,
    price_per_km_active BOOLEAN DEFAULT true,
    price_per_km DECIMAL(10,2) DEFAULT 2.50,
    fixed_price_active BOOLEAN DEFAULT false,
    fixed_price DECIMAL(10,2),
    service_fee_type TEXT DEFAULT 'fixed' CHECK (service_fee_type IN ('fixed', 'percent')),
    service_fee_value DECIMAL(10,2) DEFAULT 0,
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT singleton_pricing CHECK (singleton = true)
);

-- Create driver_payout_requests table
CREATE TABLE public.driver_payout_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status public.payout_status DEFAULT 'pending',
    payment_method TEXT NOT NULL,
    payment_details JSONB,
    notes TEXT,
    admin_notes TEXT,
    processed_by UUID REFERENCES public.profiles(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ride_ratings table
CREATE TABLE public.ride_ratings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE UNIQUE NOT NULL,
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create driver_passenger_ratings table
CREATE TABLE public.driver_passenger_ratings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_passenger_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for admin_setup
CREATE POLICY "Admins can view admin_setup" ON public.admin_setup FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);
CREATE POLICY "Admins can manage admin_setup" ON public.admin_setup FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- RLS Policies for driver_details
CREATE POLICY "Drivers can view their own details" ON public.driver_details FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Drivers can update their own details" ON public.driver_details FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Drivers can insert their own details" ON public.driver_details FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can view driver details for rides" ON public.driver_details FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.rides 
        WHERE (passenger_id = auth.uid() OR driver_id = auth.uid()) 
        AND driver_id = driver_details.user_id
    )
);

-- RLS Policies for locations
CREATE POLICY "Users can manage their own location" ON public.locations FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can view locations for active rides" ON public.locations FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.rides 
        WHERE (passenger_id = auth.uid() OR driver_id = auth.uid()) 
        AND status IN ('accepted', 'in_progress')
        AND (driver_id = locations.user_id OR passenger_id = locations.user_id)
    )
);

-- RLS Policies for rides
CREATE POLICY "Users can view their own rides" ON public.rides FOR SELECT USING (
    passenger_id = auth.uid() OR driver_id = auth.uid()
);
CREATE POLICY "Passengers can create rides" ON public.rides FOR INSERT WITH CHECK (passenger_id = auth.uid());
CREATE POLICY "Drivers can accept rides" ON public.rides FOR UPDATE USING (
    driver_id = auth.uid() OR 
    (driver_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'driver'))
);
CREATE POLICY "Passengers can update their rides" ON public.rides FOR UPDATE USING (passenger_id = auth.uid());
CREATE POLICY "Drivers can view available rides" ON public.rides FOR SELECT USING (
    (driver_id IS NULL AND status = 'pending' AND 
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'driver'))
);
CREATE POLICY "Admins can view all rides" ON public.rides FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- RLS Policies for pricing_settings
CREATE POLICY "Everyone can view pricing settings" ON public.pricing_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage pricing settings" ON public.pricing_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- RLS Policies for driver_payout_requests
CREATE POLICY "Drivers can view their own payout requests" ON public.driver_payout_requests FOR SELECT USING (driver_id = auth.uid());
CREATE POLICY "Drivers can create payout requests" ON public.driver_payout_requests FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY "Admins can view all payout requests" ON public.driver_payout_requests FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);
CREATE POLICY "Admins can update payout requests" ON public.driver_payout_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- RLS Policies for ride_ratings
CREATE POLICY "Users can view ratings for their rides" ON public.ride_ratings FOR SELECT USING (
    passenger_id = auth.uid() OR driver_id = auth.uid()
);
CREATE POLICY "Passengers can create ratings" ON public.ride_ratings FOR INSERT WITH CHECK (passenger_id = auth.uid());
CREATE POLICY "Passengers can update their ratings" ON public.ride_ratings FOR UPDATE USING (passenger_id = auth.uid());

-- RLS Policies for driver_passenger_ratings
CREATE POLICY "Users can view driver ratings" ON public.driver_passenger_ratings FOR SELECT USING (
    driver_id = auth.uid() OR passenger_id = auth.uid()
);
CREATE POLICY "Drivers can create passenger ratings" ON public.driver_passenger_ratings FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY "Drivers can update passenger ratings" ON public.driver_passenger_ratings FOR UPDATE USING (driver_id = auth.uid());

-- Functions and Triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, user_type)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'User'), 'passenger');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_details_updated_at
  BEFORE UPDATE ON public.driver_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rides_updated_at
  BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_settings_updated_at
  BEFORE UPDATE ON public.pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_payout_requests_updated_at
  BEFORE UPDATE ON public.driver_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX idx_driver_details_user_id ON public.driver_details(user_id);
CREATE INDEX idx_locations_user_id ON public.locations(user_id);
CREATE INDEX idx_rides_passenger_id ON public.rides(passenger_id);
CREATE INDEX idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX idx_rides_status ON public.rides(status);
CREATE INDEX idx_rides_created_at ON public.rides(created_at);
CREATE INDEX idx_driver_payout_requests_driver_id ON public.driver_payout_requests(driver_id);
CREATE INDEX idx_driver_payout_requests_status ON public.driver_payout_requests(status);
CREATE INDEX idx_ride_ratings_ride_id ON public.ride_ratings(ride_id);
CREATE INDEX idx_ride_ratings_driver_id ON public.ride_ratings(driver_id);
CREATE INDEX idx_driver_passenger_ratings_driver_id ON public.driver_passenger_ratings(driver_id);
CREATE INDEX idx_driver_passenger_ratings_passenger_id ON public.driver_passenger_ratings(passenger_id);

-- Enable realtime for necessary tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_payout_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_settings;

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
    2.50,
    false,
    NULL,
    'fixed',
    2.00
) ON CONFLICT DO NOTHING;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verification queries to confirm creation
SELECT 'Tables created:' as check_type, count(*) as count FROM information_schema.tables WHERE table_schema = 'public';
SELECT 'RLS policies created:' as check_type, count(*) as count FROM pg_policies WHERE schemaname = 'public';
SELECT 'Functions created:' as check_type, count(*) as count FROM information_schema.routines WHERE routine_schema = 'public';
SELECT 'Triggers created:' as check_type, count(*) as count FROM information_schema.triggers WHERE trigger_schema = 'public';
SELECT 'Indexes created:' as check_type, count(*) as count FROM pg_indexes WHERE schemaname = 'public';
SELECT 'Storage buckets:' as check_type, count(*) as count FROM storage.buckets;
