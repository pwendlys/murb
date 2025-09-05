import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  newPassword: string;
  resetSecret: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const { newPassword, resetSecret }: ResetPasswordRequest = await req.json();

    // Verificar secret de segurança
    const adminResetSecret = Deno.env.get('ADMIN_RESET_SECRET');
    if (!adminResetSecret || resetSecret !== adminResetSecret) {
      console.error('Invalid reset secret provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Validar senha
    if (!newPassword || newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Criar cliente Supabase com service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('Resetting admin password...');

    // Buscar o usuário admin
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const adminUser = users.users.find(user => user.email === 'admin@ridebuddy.com');
    
    if (!adminUser) {
      console.error('Admin user not found');
      return new Response(JSON.stringify({ error: 'Admin user not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Atualizar senha do admin
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      adminUser.id,
      {
        password: newPassword,
        user_metadata: {
          ...adminUser.user_metadata,
          full_name: 'Administrator'
        }
      }
    );

    if (updateError) {
      console.error('Error updating admin password:', updateError);
      throw updateError;
    }

    console.log('Admin password reset successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Admin password reset successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in admin-reset-password function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);