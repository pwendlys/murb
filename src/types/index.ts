
export type UserType = 'passenger' | 'driver' | 'admin';

export type ServiceType = 'moto_taxi' | 'passenger_car' | 'delivery_bike' | 'delivery_car';

export type RideStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export type PayoutStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  user_type: UserType;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ride {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  origin_address: string;
  destination_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  status: RideStatus;
  service_type: ServiceType;
  estimated_duration: number | null;
  estimated_distance: number | null;
  estimated_price: number | null;
  actual_price: number | null;
  payment_method?: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  driver_en_route?: boolean;
  en_route_started_at?: string | null;
  driver_to_pickup_distance_km?: number | null;
  driver_to_pickup_duration_min?: number | null;
  driver_arrived?: boolean;
  pickup_arrived_at?: string | null;
  profiles?: Profile;
  driver_details?: DriverDetails | null;
}

export interface Location {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  timestamp: string;
}

export interface PlaceResult {
  place_id: string;
  description: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export interface DriverPayoutRequest {
  id: string;
  driver_id: string;
  amount: number;
  status: PayoutStatus;
  payment_method: string;
  payment_details: any;
  notes: string | null;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

// Specific type for withdrawal management that matches the actual query structure
export interface DriverPayoutRequestWithProfile {
  id: string;
  driver_id: string;
  amount: number;
  status: PayoutStatus;
  payment_method: string;
  payment_details: any;
  notes: string | null;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string;
    phone: string | null;
  };
}

export interface DriverDetails {
  user_id: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
}
