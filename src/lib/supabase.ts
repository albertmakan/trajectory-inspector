import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Holds one JSON blob per run, keyed by `storage_key` — see supabase/functions/ingest-run. */
export const RUNS_BUCKET = 'trajectory-runs';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Null when the project isn't configured, which is what makes the bundled
 * runs.json fallback kick in. The publishable key is meant to ship in client
 * code: row-level security, not secrecy, is what keeps the data read-only.
 */
export const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey) : null;
