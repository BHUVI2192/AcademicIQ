import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@shared';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Using <any> here temporarily to unblock production build due to persistent 
// type inference issues with the shared Database type in the monorepo.
console.log('[Supabase] Initializing client with URL:', SUPABASE_URL?.substring(0, 20) + '...');

export const supabase = createClient<any>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'academeiq-platform-v2',
    storage: window.localStorage,
  },
  global: {
    headers: { 'x-application-name': 'academeiq' }
  }
});






export type SupabaseClientType = typeof supabase;
