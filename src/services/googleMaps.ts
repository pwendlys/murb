
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

const getGoogleMapsApiKey = async (retryCount = 0): Promise<string> => {
  const maxRetries = 3;
  
  try {
    console.log(`🔑 Buscando chave API (tentativa ${retryCount + 1})`);
    const { data, error } = await supabase.functions.invoke('get-google-maps-key');
    
    if (error) {
      console.error('🔑 Erro ao buscar chave:', error);
      throw new Error(`Failed to get Google Maps API key: ${error.message}`);
    }
    
    if (!data?.key) {
      throw new Error('API key not returned by server');
    }
    
    console.log('🔑 ✅ Chave API obtida com sucesso');
    return data.key;
  } catch (error) {
    console.error('🔑 ❌ Erro:', error);
    
    if (retryCount < maxRetries) {
      console.log(`🔑 Tentando novamente em 1 segundo... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return getGoogleMapsApiKey(retryCount + 1);
    }
    
    throw error;
  }
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
  destination: LocationCoords,
  retryCount = 0
): Promise<RouteDetails> => {
  const maxRetries = 2;
  
  try {
    console.log('🗺️ Calculando rota via Supabase Edge Function...');
    const { data, error } = await supabase.functions.invoke('calculate-route', {
      body: { origin, destination }
    });
    
    if (error) {
      console.error('🗺️ Erro na edge function:', error);
      throw new Error(`Unable to calculate route: ${error.message}`);
    }
    
    console.log('🗺️ ✅ Rota calculada com sucesso');
    return data;
  } catch (error) {
    console.error('🗺️ ❌ Erro no cálculo de rota:', error);
    
    if (retryCount < maxRetries) {
      console.log(`🗺️ Tentando novamente... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return calculateRoute(origin, destination, retryCount + 1);
    }
    
    throw error;
  }
};

export const getPlacePredictions = async (input: string, retryCount = 0): Promise<PlacePrediction[]> => {
  if (input.length < 3) return [];
  
  const maxRetries = 2;
  
  try {
    console.log(`🏢 Buscando sugestões para: "${input}"`);
    const { data, error } = await supabase.functions.invoke('places-autocomplete', {
      body: { input }
    });
    
    if (error) {
      console.error('🏢 Erro na edge function:', error);
      throw new Error(`Error getting place predictions: ${error.message}`);
    }
    
    const predictions = data?.predictions || [];
    console.log(`🏢 ✅ ${predictions.length} sugestões encontradas`);
    return predictions;
  } catch (error) {
    console.error('🏢 ❌ Erro ao buscar sugestões:', error);
    
    if (retryCount < maxRetries) {
      console.log(`🏢 Tentando novamente... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 500));
      return getPlacePredictions(input, retryCount + 1);
    }
    
    // Return empty array on final failure to prevent breaking the UI
    return [];
  }
};

export const getPlaceDetails = async (placeId: string, retryCount = 0): Promise<LocationCoords> => {
  const maxRetries = 2;
  
  try {
    console.log(`📍 Buscando detalhes do local: ${placeId}`);
    const { data, error } = await supabase.functions.invoke('place-details', {
      body: { placeId }
    });
    
    if (error) {
      console.error('📍 Erro na edge function:', error);
      throw new Error(`Unable to get place details: ${error.message}`);
    }
    
    console.log('📍 ✅ Detalhes do local obtidos');
    return data;
  } catch (error) {
    console.error('📍 ❌ Erro ao buscar detalhes:', error);
    
    if (retryCount < maxRetries) {
      console.log(`📍 Tentando novamente... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return getPlaceDetails(placeId, retryCount + 1);
    }
    
    throw error;
  }
};
