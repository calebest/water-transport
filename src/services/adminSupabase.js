import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

/**
 * Admin Supabase client using the service role key.
 * This bypasses Row-Level Security and email confirmation requirements.
 * NEVER expose this client or the service role key to end users.
 * Only import in admin-gated pages (e.g., Users.jsx).
 */
export const adminSupabase = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
