
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { origin, destination } = await req.json()
    
    if (!origin || !destination) {
      throw new Error('Origin and destination are required')
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      throw new Error('Google Maps API key not configured')
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${apiKey}`
    )
    
    const data = await response.json()
    
    if (data.status === 'OK' && data.routes.length > 0) {
      const route = data.routes[0].legs[0]
      const distanceKm = route.distance.value / 1000
      const durationMin = Math.round(route.duration.value / 60)
      
      // Calculate price: base fare + distance rate
      const baseFare = 5.0
      const ratePerKm = 2.5
      const price = baseFare + (distanceKm * ratePerKm)
      
      return new Response(
        JSON.stringify({
          distance: `${distanceKm.toFixed(1)} km`,
          duration: `${durationMin} min`,
          price: price
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Unable to calculate route')
  } catch (error) {
    console.error('Error in calculate-route:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
