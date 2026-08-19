// src/lib/supabase/client.ts - Browser-side Supabase client singleton

import { createBrowserClient } from '@supabase/ssr';
import { env } from '../env';

export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Global browser instance
export const supabase = createClient();
