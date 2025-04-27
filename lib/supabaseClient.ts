import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Prioritize regular env vars, then fallback to NEXT_PUBLIC ones if available
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

// Debug environment variables (don't log full keys in production)
console.log('Debug Supabase configuration:');
console.log('URL defined:', !!supabaseUrl);
console.log('Service Role Key defined:', !!supabaseServiceRoleKey);
console.log('Available env keys:', Object.keys(process.env)
  .filter(key => key.includes('SUPABASE') || key.includes('NEXT_PUBLIC_SUPABASE'))
  .join(', '));

// More robust environment variable checking
if (!supabaseUrl) {
  throw new Error('Missing Supabase URL environment variable. Please check your .env.local file has NEXT_PUBLIC_SUPABASE_URL defined correctly.');
}

if (!supabaseServiceRoleKey) {
  throw new Error('Missing Supabase Service Role Key environment variable. Please check your .env.local file has SUPABASE_SERVICE_ROLE_KEY defined correctly.');
}

// Initialize with null, but provide the type annotation
let supabaseAdmin: SupabaseClient | null = null;

// Create a single supabase client for interacting with your database
// Note: Using the service_role key bypasses RLS. Be mindful of security
// if you intend to use this client in contexts requiring user-specific permissions.
// For API routes performing admin-like tasks, this is often necessary.
try {
  console.log(`Initializing Supabase Admin Client with URL: ${supabaseUrl.substring(0, 20)}...`);
  
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  console.log("Supabase Admin Client initialized successfully");
  
  // Test the connection in the background
  (async () => {
    try {
      console.log("Testing Supabase connection...");
      const { data, error, status } = await supabaseAdmin
        .from('projects')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error("Error testing Supabase connection:", error);
        console.error("Response status:", status);
        if (status === 404) {
          console.error("Table 'projects' might not exist. Make sure your database schema is set up correctly.");
        }
      } else {
        console.log(`Supabase connection test successful - Projects table available`);
      }
    } catch (err) {
      console.error("Failed to test Supabase connection:", err);
    }
  })();
    
} catch (error) {
  console.error("Failed to initialize Supabase client:", error);
  throw new Error(`Supabase client initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

// Export the initialized client
export { supabaseAdmin };

// Optional: You might create a separate client for frontend use later
// using the anon key if you need RLS based on user sessions.
// export const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!) 