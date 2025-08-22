
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('📍 place-details - Nova requisição:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📍 Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { placeId } = await req.json()
    console.log('📍 Place ID recebido:', placeId);
    
    if (!placeId) {
      console.error('📍 ❌ Place ID não fornecido');
      throw new Error('Place ID is required')
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      console.error('📍 ❌ Chave API não encontrada');
      throw new Error('Google Maps API key not configured')
    }

    console.log('📍 Buscando detalhes do local via Google Places API...');
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${apiKey}&language=pt-BR`
    )
    
    const data = await response.json()
    console.log('📍 Resposta da API:', data.status);
    
    if (data.status === 'OK' && data.result.geometry) {
      const location = data.result.geometry.location
      console.log('📍 ✅ Localização encontrada:', location);
      
      return new Response(
        JSON.stringify({ 
          lat: location.lat, 
          lng: location.lng,
          address: data.result.formatted_address || null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.error('📍 ❌ Falha ao obter detalhes do local:', data.status, data.error_message);
    throw new Error(`Unable to get place details: ${data.status}`)
  } catch (error) {
    console.error('📍 ❌ Erro na função:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
