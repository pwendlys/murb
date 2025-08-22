
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🏢 places-autocomplete - Nova requisição:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🏢 Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { input } = await req.json()
    console.log('🏢 Input recebido:', input);
    
    if (!input || input.length < 3) {
      console.log('🏢 Input muito curto, retornando array vazio');
      return new Response(
        JSON.stringify({ predictions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      console.error('🏢 ❌ Chave API não encontrada');
      throw new Error('Google Maps API key not configured')
    }

    console.log('🏢 Fazendo requisição para Google Places API...');
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&language=pt-BR&components=country:br`
    )
    
    const data = await response.json()
    console.log('🏢 Resposta da API:', data.status, data.predictions?.length, 'sugestões');
    
    if (data.status === 'OK' && data.predictions) {
      const predictions = data.predictions.map((prediction: any) => ({
        place_id: prediction.place_id,
        description: prediction.description,
        main_text: prediction.structured_formatting.main_text,
        secondary_text: prediction.structured_formatting.secondary_text || ''
      }))
      
      console.log('🏢 ✅ Retornando', predictions.length, 'sugestões');
      return new Response(
        JSON.stringify({ predictions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🏢 ⚠️ Nenhuma sugestão encontrada');
    return new Response(
      JSON.stringify({ predictions: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('🏢 ❌ Erro na função:', error);
    return new Response(
      JSON.stringify({ error: error.message, predictions: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
