// src/lib/supabase/admin.ts - Elevated Supabase service-role client (SERVER ONLY)

import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    // If service role key is not configured, fall back to anon client
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
