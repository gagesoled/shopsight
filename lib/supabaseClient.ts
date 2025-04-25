import { createClient } from '@supabase/supabase-js'

// Prioritize regular env vars, then fallback to NEXT_PUBLIC ones if available
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('Missing Supabase URL environment variable');
  console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));
  throw new Error('Missing Supabase URL environment variable')
}

if (!supabaseServiceRoleKey) {
  console.error('Missing Supabase Service Role Key environment variable');
  console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));
  throw new Error('Missing Supabase Service Role Key environment variable')
}

// Create a single supabase client for interacting with your database
// Note: Using the service_role key bypasses RLS. Be mindful of security
// if you intend to use this client in contexts requiring user-specific permissions.
// For API routes performing admin-like tasks, this is often necessary.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        // Automatically handle refreshing sessions if needed (though less relevant for service role)
        autoRefreshToken: true,
        persistSession: false,
        // Detect session automatically from cookies - less relevant for service key but good practice
        detectSessionInUrl: false
    }
})

console.log("Supabase Admin Client Initialized with URL:", supabaseUrl); // Add log for confirmation

// Optional: You might create a separate client for frontend use later
// using the anon key if you need RLS based on user sessions.
// export const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!) 