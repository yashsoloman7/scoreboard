// src/lib/env.ts - Centralized environment variables configuration

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example-supabase-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'example-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  isProduction: process.env.NODE_ENV === 'production',
};

export function validateServerEnv() {
  if (process.env.NODE_ENV === 'production') {
    const hasKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !hasKey) {
      console.warn('[SECURITY WARNING] Supabase URL or Publishable Key is missing in production environment!');
    }
  }
}

