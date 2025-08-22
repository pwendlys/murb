
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🔑 get-google-maps-key - Nova requisição:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔑 Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔑 Buscando chave do Google Maps...');
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    
    if (!apiKey) {
      console.error('🔑 ❌ Chave API não encontrada no ambiente');
      throw new Error('Google Maps API key not configured')
    }

    console.log('🔑 ✅ Chave API encontrada, retornando para o cliente');
    return new Response(
      JSON.stringify({ key: apiKey }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('🔑 ❌ Erro na função:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
