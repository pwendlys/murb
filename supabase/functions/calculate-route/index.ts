
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🗺️ calculate-route - Nova requisição:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🗺️ Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { origin, destination } = await req.json()
    console.log('🗺️ Origem:', origin, 'Destino:', destination);
    
    if (!origin || !destination) {
      console.error('🗺️ ❌ Origem ou destino não fornecidos');
      throw new Error('Origin and destination are required')
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      console.error('🗺️ ❌ Chave API não encontrada');
      throw new Error('Google Maps API key not configured')
    }

    console.log('🗺️ Calculando rota via Google Directions API...');
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${apiKey}&language=pt-BR`
    )
    
    const data = await response.json()
    console.log('🗺️ Resposta da API:', data.status);
    
    if (data.status === 'OK' && data.routes.length > 0) {
      const route = data.routes[0].legs[0]
      const distanceKm = route.distance.value / 1000
      const durationMin = Math.round(route.duration.value / 60)
      
      // Calculate price for motorcycle rides
      const baseFare = 3.0 // Lower base fare for motorcycle
      const ratePerKm = 1.8 // Lower rate per km for motorcycle
      const price = baseFare + (distanceKm * ratePerKm)
      
      console.log('🗺️ ✅ Rota calculada:', {
        distance: `${distanceKm.toFixed(1)} km`,
        duration: `${durationMin} min`,
        price: price.toFixed(2)
      });
      
      return new Response(
        JSON.stringify({
          distance: `${distanceKm.toFixed(1)} km`,
          duration: `${durationMin} min`,
          price: price
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.error('🗺️ ❌ Falha ao calcular rota:', data.status, data.error_message);
    throw new Error(`Unable to calculate route: ${data.status}`)
  } catch (error) {
    console.error('🗺️ ❌ Erro na função:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
