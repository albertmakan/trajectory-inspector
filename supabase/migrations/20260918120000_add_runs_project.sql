-- Scopes runs to a project, and makes `demo` the only publicly readable one.
--
-- The app's publishable key ships in the browser bundle, so filtering the query
-- client-side would be cosmetic: anyone could re-query the table for other
-- projects. The boundary therefore lives in the select policy, and the client
-- filter that mirrors it is a convenience, not the control.
--
-- The default is deliberately NOT 'demo'. A run ingested without naming a
-- project lands in 'default' and is invisible to `anon` — failing closed, so
-- real instrumented runs are never published by forgetting to curate them.

alter table public.runs
  add column if not exists project text not null default 'default'
    check (project <> '');

-- Everything ingested so far is the synthetic dataset behind the public demo.
-- Safe to run unconditionally: the column is new, so no other value exists yet.
update public.runs set project = 'demo';

-- The run list filters on project and orders by started_at desc; this covers
-- both halves of that query.
create index if not exists runs_project_started_at_idx
  on public.runs (project, started_at desc);

-- Supersedes runs_started_at_idx from 20260912120000_init_runs.sql. Every query
-- that orders by started_at now also filters by project, which the composite
-- index above covers; a bare (started_at desc) index would only help an ordered
-- scan across all projects, and nothing does that any more.
drop index if exists public.runs_started_at_idx;

-- Replaces the `using (true)` policy from 20260912120000_init_runs.sql. Writes
-- are still policy-less and so still reachable only by the ingest function's
-- secret key, which bypasses RLS. Widening public access later means editing
-- this policy in a NEW migration, never this one.
drop policy if exists "runs are publicly readable" on public.runs;

create policy "demo runs are publicly readable"
  on public.runs
  for select
  to anon, authenticated
  using (project = 'demo');

-- Note: this hides non-demo *rows*, not their trajectory blobs. The
-- `trajectory-runs` bucket is public, so any blob is still fetchable at
-- runs/<id>.json by anyone who knows the id. Hiding the row hides the id, which
-- is obscurity rather than a boundary — closing that needs a private bucket and
-- signed URLs for non-demo runs.
