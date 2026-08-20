// Quick Supabase connection test
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log('=== Supabase Connection Test ===');
console.log(`URL: ${url}`);
console.log(`Key: ${key ? key.substring(0, 20) + '...' : 'MISSING'}`);
console.log('');

if (!url || !key) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

try {
  // Test 1: Basic connectivity — try to query a table
  console.log('[Test 1] Querying tables...');
  const { data, error } = await supabase.from('competitions').select('id, name').limit(5);

  if (error) {
    console.log(`  Result: Got error (this may be expected if RLS is active)`);
    console.log(`  Error code: ${error.code}`);
    console.log(`  Error message: ${error.message}`);
    // An RLS error or "no rows" still means connectivity is working
    if (error.code === 'PGRST116' || error.message.includes('permission') || error.code === '42501') {
      console.log('  ✅ Connection WORKS — RLS is blocking unauthenticated access (expected)');
    } else if (error.code === '42P01') {
      console.log('  ✅ Connection WORKS — table does not exist yet');
    } else {
      console.log(`  ⚠️  Unexpected error, but connection may still be working`);
    }
  } else {
    console.log(`  ✅ Connection WORKS — got ${data?.length ?? 0} rows from competitions table`);
    if (data && data.length > 0) {
      console.log('  Sample data:', JSON.stringify(data[0]));
    }
  }

  // Test 2: Auth health check
  console.log('\n[Test 2] Auth health check...');
  const { data: session, error: authError } = await supabase.auth.getSession();
  if (authError) {
    console.log(`  Auth error: ${authError.message}`);
  } else {
    console.log(`  ✅ Auth endpoint responding — session: ${session?.session ? 'active' : 'none (anonymous)'}`);
  }

  console.log('\n=== Connection test complete ===');
} catch (err) {
  console.error('FATAL: Could not connect to Supabase');
  console.error(err.message);
  process.exit(1);
}
