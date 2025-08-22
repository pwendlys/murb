
import { supabase } from '@/integrations/supabase/client';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface RouteDetails {
  distance: string;
  duration: string;
  price: number;
}

export interface PlacePrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

const getGoogleMapsApiKey = async (): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('get-google-maps-key');
  if (error) throw new Error('Failed to get Google Maps API key');
  return data.key;
};

export const geocodeAddress = async (address: string): Promise<LocationCoords> => {
  const apiKey = await getGoogleMapsApiKey();
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
  );
  
  const data = await response.json();
  
  if (data.status === 'OK' && data.results.length > 0) {
    const location = data.results[0].geometry.location;
    return { lat: location.lat, lng: location.lng };
  }
  
  throw new Error('Unable to geocode address');
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const apiKey = await getGoogleMapsApiKey();
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
  );
  
  const data = await response.json();
  
  if (data.status === 'OK' && data.results.length > 0) {
    return data.results[0].formatted_address;
  }
  
  return 'Localização Atual';
};

export const calculateRoute = async (
  origin: LocationCoords,
  destination: LocationCoords
): Promise<RouteDetails> => {
  const { data, error } = await supabase.functions.invoke('calculate-route', {
    body: { origin, destination }
  });
  
  if (error) throw new Error('Unable to calculate route');
  return data;
};

export const getPlacePredictions = async (input: string): Promise<PlacePrediction[]> => {
  if (input.length < 3) return [];
  
  const { data, error } = await supabase.functions.invoke('places-autocomplete', {
    body: { input }
  });
  
  if (error) {
    console.error('Error getting place predictions:', error);
    return [];
  }
  
  return data.predictions || [];
};

export const getPlaceDetails = async (placeId: string): Promise<LocationCoords> => {
  const { data, error } = await supabase.functions.invoke('place-details', {
    body: { placeId }
  });
  
  if (error) throw new Error('Unable to get place details');
  return data;
};
