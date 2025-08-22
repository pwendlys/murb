
-- Create enum for payout status
CREATE TYPE public.payout_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

-- Create driver payout requests table
CREATE TABLE public.driver_payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES public.profiles(id) NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status public.payout_status NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL,
  payment_details JSONB,
  notes TEXT,
  admin_notes TEXT,
  processed_by UUID REFERENCES public.profiles(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Drivers can view their own requests
CREATE POLICY "Drivers can view own payout requests" 
  ON public.driver_payout_requests 
  FOR SELECT 
  USING (
    auth.uid() = driver_id OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Drivers can create their own requests
CREATE POLICY "Drivers can create payout requests" 
  ON public.driver_payout_requests 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = driver_id AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'driver'
    )
  );

-- Only admins can update requests
CREATE POLICY "Admins can update payout requests" 
  ON public.driver_payout_requests 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER set_driver_payout_requests_updated_at
  BEFORE UPDATE ON public.driver_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_payout_requests;
