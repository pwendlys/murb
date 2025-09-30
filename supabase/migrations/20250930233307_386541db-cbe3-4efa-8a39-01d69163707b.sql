-- Migrate existing passenger ratings from driver_passenger_ratings to ride_ratings
-- This ensures all ratings are in one unified table

-- Insert ratings from driver_passenger_ratings into ride_ratings
-- Only insert if they don't already exist to avoid duplicates
INSERT INTO public.ride_ratings (
  ride_id,
  reviewer_id,
  reviewee_id,
  rating,
  comment,
  created_at,
  updated_at
)
SELECT 
  dpr.ride_id,
  dpr.created_by as reviewer_id,
  r.passenger_id as reviewee_id,
  dpr.rating,
  dpr.comment,
  dpr.created_at,
  dpr.updated_at
FROM public.driver_passenger_ratings dpr
JOIN public.rides r ON r.id = dpr.ride_id
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.ride_ratings rr 
  WHERE rr.ride_id = dpr.ride_id 
  AND rr.reviewer_id = dpr.created_by
);