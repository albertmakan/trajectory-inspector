/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL; absent in local/offline use, which selects the runs.json fallback. */
  readonly VITE_SUPABASE_URL?: string;
  /** `sb_publishable_…` key. Reads are restricted by RLS, not by hiding this. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
