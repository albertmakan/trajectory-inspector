-- One row per agent execution, top-level or sub-agent.
--
-- The full trajectory — every step, with its payloads — is a JSON blob in the
-- `trajectory-runs` Storage bucket. This table holds only the fields the run
-- list filters and sorts on, so listing runs never opens a blob.

create table if not exists runs (
  id uuid primary key,
  -- Self-referencing: a sub-agent run points at the run that spawned it, and at
  -- the specific step that did. Rows must therefore be inserted parents-first.
  parent_run_id uuid references runs (id) on delete cascade,
  parent_step_id uuid,
  depth int not null default 0,              -- 0 = top-level, 1 = sub-agent, ...
  task text not null,
  model text not null,
  status text not null check (status in ('success', 'failure', 'in_progress', 'timeout')),
  started_at timestamptz not null,
  ended_at timestamptz,                      -- null while a run is still in progress
  total_tokens_input int,
  total_tokens_output int,
  total_cost numeric,
  tags text[] not null default '{}',
  -- Denormalized from the steps array at ingest, so the run list can show step
  -- counts and flag failures without fetching anything from Storage.
  step_count int,
  has_error boolean not null default false,
  storage_key text not null,                 -- path to the blob in the bucket
  created_at timestamptz not null default now()
);

create index if not exists runs_status_idx on runs (status);
create index if not exists runs_tags_idx on runs using gin (tags);
create index if not exists runs_parent_run_id_idx on runs (parent_run_id);
create index if not exists runs_started_at_idx on runs (started_at desc);

-- Reads are public; writes go only through the ingest-run function, whose
-- secret key bypasses RLS. The absence of an insert/update/delete policy is
-- deliberate — it is what makes the table read-only to the app's publishable key.
-- (`anon` and `authenticated` below are Postgres roles, not key names.)
alter table runs enable row level security;

drop policy if exists "runs are publicly readable" on runs;

create policy "runs are publicly readable"
  on runs
  for select
  to anon, authenticated
  using (true);

-- A public bucket makes each trajectory blob readable by URL, so opening a run
-- needs no policy on storage.objects and no signed-URL round trip.
insert into storage.buckets (id, name, public)
values ('trajectory-runs', 'trajectory-runs', true)
on conflict (id) do nothing;
