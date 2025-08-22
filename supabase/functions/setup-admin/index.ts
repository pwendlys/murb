
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { password } = await req.json()

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const adminUserId = '00000000-0000-0000-0000-000000000001'
    const adminEmail = 'admin@ridebuddy.com'

    console.log('Setting up admin user...')

    // First, try to get existing user by email instead of ID
    const { data: existingUserByEmail, error: getUserByEmailError } = await supabaseAdmin.auth.admin.listUsers()
    
    console.log('Listed users, looking for admin email...')
    
    const existingUser = existingUserByEmail?.users?.find(user => user.email === adminEmail)
    
    if (existingUser) {
      console.log('Admin user exists, updating password and metadata...')
      
      // Update the existing admin user's password and metadata
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { 
          password,
          user_metadata: {
            full_name: 'Administrator',
            user_type: 'admin'
          }
        }
      )

      if (updateError) {
        console.error('Error updating admin user:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update admin user: ' + updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      
      console.log('Admin user updated successfully')
      
      // Upsert the admin profile with the existing user's ID
      console.log('Upserting admin profile with existing user ID:', existingUser.id)
      
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: existingUser.id,
          full_name: 'Administrator',
          user_type: 'admin',
          is_active: true
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.error('Error upserting admin profile:', profileError)
        return new Response(
          JSON.stringify({ error: 'Failed to create admin profile: ' + profileError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Update admin setup with existing user ID
      const { error: setupError } = await supabaseAdmin
        .from('admin_setup')
        .upsert({ 
          admin_user_id: existingUser.id,
          password_set: true, 
          updated_at: new Date().toISOString() 
        }, {
          onConflict: 'admin_user_id'
        })

      if (setupError) {
        console.error('Error updating admin setup:', setupError)
        return new Response(
          JSON.stringify({ error: 'Failed to update admin setup: ' + setupError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      
    } else {
      console.log('Creating new admin user...')
      
      // Create the admin user if it doesn't exist
      const { data: createUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: 'Administrator',
          user_type: 'admin'
        }
      })

      if (createUserError) {
        console.error('Error creating admin user:', createUserError)
        return new Response(
          JSON.stringify({ error: 'Failed to create admin user: ' + createUserError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      const newUserId = createUserData.user?.id
      if (!newUserId) {
        return new Response(
          JSON.stringify({ error: 'Failed to get new user ID' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      console.log('Admin user created successfully with ID:', newUserId)

      // Upsert the admin profile with the new user's ID
      console.log('Upserting admin profile with new user ID:', newUserId)

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newUserId,
          full_name: 'Administrator',
          user_type: 'admin',
          is_active: true
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.error('Error upserting admin profile:', profileError)
        return new Response(
          JSON.stringify({ error: 'Failed to create admin profile: ' + profileError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Mark password as set in admin_setup using the new user ID
      const { error: setupError } = await supabaseAdmin
        .from('admin_setup')
        .upsert({ 
          admin_user_id: newUserId,
          password_set: true, 
          updated_at: new Date().toISOString() 
        }, {
          onConflict: 'admin_user_id'
        })

      if (setupError) {
        console.error('Error updating admin setup:', setupError)
        return new Response(
          JSON.stringify({ error: 'Failed to update admin setup: ' + setupError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    console.log('Admin setup completed successfully')

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in setup-admin function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error: ' + error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
