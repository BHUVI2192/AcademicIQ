// ============================================================================
// AcademeIQ Platform — Supabase Client (shared)
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/index';

export type AcademeIQSupabaseClient = SupabaseClient<Database>;

interface ClientConfig {
  url: string;
  anonKey: string;
}

export function createAcademeIQClient(config: ClientConfig): AcademeIQSupabaseClient {
  if (!config.url || !config.anonKey) {
    throw new Error('Supabase URL and anon key are required');
  }
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
