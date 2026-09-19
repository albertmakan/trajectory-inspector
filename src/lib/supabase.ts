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

/** The one project `anon` may read — see 20260918120000_add_runs_project.sql. */
export const DEMO_PROJECT = 'demo';

/**
 * Which project the run list shows. The select policy pins the publishable key
 * to `demo`, so pointing this elsewhere returns nothing until that policy is
 * widened; it exists so the scope is explicit in the query rather than implicit
 * in RLS, and so a future authenticated view has a knob to turn.
 */
export const RUNS_PROJECT = import.meta.env.VITE_PROJECT || DEMO_PROJECT;
