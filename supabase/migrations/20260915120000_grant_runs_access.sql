-- Table privileges for the Data API roles.
--
-- RLS and GRANTs are separate layers: the previous migration's policy decides
-- which rows a role may see, but without a GRANT PostgREST rejects the request
-- outright with `42501 permission denied for table runs` — which is what both
-- the publishable key (role `anon`) and the ingest function's secret key
-- (role `service_role`) hit. A secret key bypasses RLS; it does not bypass
-- GRANTs. This project does not auto-expose new tables to those roles (see
-- `auto_expose_new_tables` in config.toml), so the grants are explicit.

-- Reads for the app. The select policy from the previous migration still governs
-- which rows these roles can actually see.
grant select on table public.runs to anon, authenticated;

-- Writes for the ingest function only. No RLS write policy exists, so this is
-- reachable solely by the service_role key, which bypasses RLS.
grant select, insert, update, delete on table public.runs to service_role;
