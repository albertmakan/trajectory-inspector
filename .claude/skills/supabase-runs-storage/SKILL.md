---
name: supabase-runs-storage
description: How trajectory runs are stored in and served from Supabase — the runs table, the trajectory-runs bucket, the ingest-run edge function, API keys, and the RLS-vs-GRANTs rules that govern access. Use when changing the schema, the ingest path, permissions, seeding, or how the app reads runs.
---

# Supabase storage for trajectory runs

## Shape of the data

Two halves, deliberately split:

- **`public.runs`** — one row per run (top-level or sub-agent), metadata only: task, model,
  status, timings, cost, tags, plus `step_count` / `has_error` denormalized at ingest and a
  `storage_key` pointing at the blob.
- **`trajectory-runs` bucket** — one immutable JSON blob per run at `runs/<run id>.json`,
  holding the full `Run` including every step. Largest is ~19 KB.

The split is what keeps the run list to a single query with no blob reads. Opening a run is the
expensive case: the timeline, call graph and diff all recurse into sub-runs, so hydrating one run
means fetching **its entire descendant subtree**, walked via `parent_run_id`.

`parent_run_id` is a self-referencing FK, so rows must be inserted **parents first**. The seed
script sorts by ascending `depth` for exactly this reason.

## Two permission layers — the thing that bites

**RLS and GRANTs are independent, and a secret/service_role key bypasses only RLS.** Enabling RLS
with a `select` policy is not enough; without a table GRANT, PostgREST rejects the request before
policies are ever consulted.

Symptom — and note it hits the *secret* key too, which is the giveaway that it isn't RLS:

```
{"code":"42501","message":"permission denied for table runs",
 "hint":"Grant the required privileges to the current role with: GRANT SELECT ON public.runs TO anon;"}
```

The fix, and what `20260915120000_grant_runs_access.sql` does:

```sql
grant select on table public.runs to anon, authenticated;
grant select, insert, update, delete on table public.runs to service_role;
```

Related: `auto_expose_new_tables` in `config.toml` controls whether new `public` tables are
reachable by the Data API roles without explicit grants. Don't rely on it — grant explicitly.

**Storage is a separate service from PostgREST and needs no GRANTs.** A public bucket is readable
with the publishable key *and* anonymously; only Postgres tables have the GRANT layer.

## API keys

Use the new pair. Legacy `anon`/`service_role` JWTs are deprecated at the end of 2026, though both
systems work simultaneously and creating new keys doesn't revoke the old ones.

| | Key | Where |
|---|---|---|
| Client | `sb_publishable_…` | Ships in the browser bundle. RLS restricts it, not secrecy. |
| Server | `sb_secret_…` | Server-only; rejected in a browser via a `User-Agent` check. |

**Send API keys on the `apikey` header, never `Authorization: Bearer`.** They aren't JWTs;
`Authorization` is for user session tokens, and a secret key sent there can be rejected as an
invalid JWT. `supabase-js` sets `apikey` itself, so `createClient(url, publishableKey)` is fine.

`.env` (gitignored) — one file is enough, since Vite exposes only `VITE_*` to the bundle:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…    # seed script only — never VITE_ prefixed
```

The deployed edge function reads **none** of this; the platform injects its own credentials.

## Edge function

Layout must be `supabase/functions/<name>/index.ts` — a bare `<name>.ts` is not picked up.

Injected automatically: `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_PUBLISHABLE_KEYS`,
`SUPABASE_JWKS`, plus legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. The new variables
hold a **JSON object keyed by name**, not a plain string:

```ts
const secretKey =
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;   // works under either key system
```

**Authorization: `[functions.<name>]` in `config.toml` supports only `enabled`, `verify_jwt`,
`import_map`, `entrypoint`, `static_files` — there is no `auth` key.** `verify_jwt` validates user
session JWTs and does not authenticate an API-key caller at all. For a service-to-service function,
set `verify_jwt = false` and authorize inside the handler:

```ts
if ((req.headers.get("apikey") ?? "") !== secretKey) {
  return json({ error: "Unauthorized" }, 401);
}
```

`deno check supabase/functions/ingest-run/index.ts` type-checks it — `tsconfig.json` only includes
`src`, so `npm run typecheck` never touches this file.

## Ingest invariants

- **Blob first, then row.** If the row insert fails, delete the blob — Storage and Postgres must
  never drift. (This is why a failed seed leaves no orphans.)
- **Runs are immutable**: `upsert: false`. A repeat POST fails with
  `Storage write failed: The resource already exists` and writes nothing.
- `step_count` and `has_error` are derived from the steps at ingest so the run list never opens a blob.

## Migrations

Never edit a migration that has been pushed — add a new one; the CLI tracks applied files. The
bucket itself is created in SQL so it's versioned with the schema:

```sql
insert into storage.buckets (id, name, public)
values ('trajectory-runs','trajectory-runs',true) on conflict (id) do nothing;
```

Commands (`link`, `db push`, `functions deploy`) need management-API auth via `supabase login` or
`SUPABASE_ACCESS_TOKEN`; `db push` also needs the database password.

## Verification recipes

Row counts via PostgREST, without fetching rows:

```bash
curl -s -D - -o /dev/null "$url/rest/v1/runs?select=id" \
  -H "apikey: $pub" -H "Prefer: count=exact" -H "Range: 0-0" | grep -i content-range
# content-range: 0-0/60
```

Known-good totals for the seeded dataset: **60 rows, 25 with null `parent_run_id`, max depth 2,
`sum(step_count)` 934, 24 rows with `has_error`, 60 blobs in the bucket.**

Permission smoke tests, each of which should hold after any change:

```bash
# ingest rejects an unauthenticated caller
curl -X POST "$url/functions/v1/ingest-run" -d '{}'                      # 401
# ingest accepts the secret key, then rejects a bad payload
curl -X POST "$url/functions/v1/ingest-run" -H "apikey: $sec" -d '{}'    # 400 Invalid run payload
# RLS blocks writes from the client key
curl -X POST "$url/rest/v1/runs" -H "apikey: $pub" -d '{...}'            # 401
```

A 400 on the second one is the proof that the secret key in `.env` matches the
`SUPABASE_SECRET_KEYS.default` the platform injects — a mismatch shows up as 401 instead.
