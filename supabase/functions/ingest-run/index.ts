// Ingests one agent Run: writes the full trajectory JSON to Storage,
// then inserts a metadata row into Postgres pointing at it.
//
// Deploy:   npx supabase functions deploy ingest-run
// Invoke:   POST /functions/v1/ingest-run   body: Run (see below)
//
// Callers must present the project's secret key on the `apikey` header — it is
// the service-role credential, so it gets past RLS to write.

import { createClient } from "npm:@supabase/supabase-js@2";

// --- Types (mirrors the app's Run/Step schema in src/schema.ts) -------------

interface Step {
  id: string;
  index: number;
  type: "model_turn" | "tool_call" | "tool_result" | "error" | "subagent_call";
  status: "ok" | "error";
  durationMs: number;
  toolResult?: { output: unknown; error?: string };
  subagentCall?: { subRunId: string; task: string; status: string };
}

interface Run {
  id: string;
  project?: string;
  parentRunId?: string;
  parentStepId?: string;
  depth: number;
  task: string;
  model: string;
  status: "success" | "failure" | "in_progress" | "timeout";
  startedAt: string;
  endedAt: string;
  totalTokens: { input: number; output: number };
  totalCost: number;
  tags: string[];
  steps: Step[];
}

// --- Config ---------------------------------------------------------------

const BUCKET = "trajectory-runs";

// Where a run lands when it doesn't name a project. Deliberately not "demo":
// the select policy publishes only "demo", so an unscoped run stays private
// rather than being exposed by omission.
const DEFAULT_PROJECT = "default";

// New-style secret keys are injected as a JSON object keyed by name; the legacy
// service-role variable is a plain string, still injected until those keys are
// retired at the end of 2026. Prefer the new one, fall back to the old.
const secretKey =
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  secretKey, // bypasses RLS, so this must stay server-side
);

// --- Validation -------------------------------------------------------------

function validateRun(run: unknown): run is Run {
  if (typeof run !== "object" || run === null) return false;
  const r = run as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.task === "string" &&
    typeof r.model === "string" &&
    typeof r.status === "string" &&
    typeof r.startedAt === "string" &&
    Array.isArray(r.steps)
  );
}

// --- Denormalized fields derived from the steps array ----------------------
// Computed once at ingestion so the Run List view never has to open the blob.

function deriveMetadata(run: Run) {
  const hasError = run.steps.some(
    (s) => s.status === "error" || s.type === "error",
  );
  return {
    step_count: run.steps.length,
    has_error: hasError,
  };
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// --- Handler ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // The gateway's JWT check authenticates user sessions, not API keys, so it is
  // disabled for this function (see config.toml) and the handler authorizes the
  // caller itself. Ingest is server-to-server only: the key never leaves a server.
  if ((req.headers.get("apikey") ?? "") !== secretKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  let run: Run;
  try {
    const body = await req.json();
    if (!validateRun(body)) {
      return json({ error: "Invalid run payload" }, 400);
    }
    run = body;
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  // A sub-agent run must share the project of the run that spawned it: opening a
  // run hydrates its whole subtree, so a child scoped elsewhere would be hidden
  // by the policy and leave a subagent_call pointing at nothing.
  let project = run.project?.trim() || DEFAULT_PROJECT;

  if (run.parentRunId) {
    const { data: parent, error } = await supabase
      .from("runs")
      .select("project")
      .eq("id", run.parentRunId)
      .maybeSingle();

    if (error) {
      return json({ error: `Parent lookup failed: ${error.message}` }, 500);
    }
    if (!parent) {
      return json({ error: `Unknown parentRunId ${run.parentRunId}` }, 400);
    }

    project = parent.project as string;
  }

  const storageKey = `runs/${run.id}.json`;

  // 1. Write the full blob to Storage FIRST. If this fails, we bail before
  //    touching the database — never insert a metadata row that points at
  //    nothing.
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, JSON.stringify({ ...run, project }), {
      contentType: "application/json",
      upsert: false, // runs are immutable — reject accidental overwrites
    });

  if (storageError) {
    return json({ error: `Storage write failed: ${storageError.message}` }, 500);
  }

  // 2. Insert the metadata row. If this fails, clean up the orphaned blob
  //    rather than leaving storage and DB out of sync.
  const { step_count, has_error } = deriveMetadata(run);

  const { error: dbError } = await supabase.from("runs").insert({
    id: run.id,
    project,
    parent_run_id: run.parentRunId ?? null,
    parent_step_id: run.parentStepId ?? null,
    depth: run.depth,
    task: run.task,
    model: run.model,
    status: run.status,
    started_at: run.startedAt,
    ended_at: run.endedAt || null, // in-progress runs carry an empty string
    total_tokens_input: run.totalTokens?.input ?? null,
    total_tokens_output: run.totalTokens?.output ?? null,
    total_cost: run.totalCost ?? null,
    tags: run.tags ?? [],
    step_count,
    has_error,
    storage_key: storageKey,
  });

  if (dbError) {
    // Rollback: remove the blob we just wrote so storage doesn't accumulate
    // orphans with no corresponding row.
    await supabase.storage.from(BUCKET).remove([storageKey]);

    return json({ error: `DB insert failed: ${dbError.message}` }, 500);
  }

  return json({ id: run.id, storageKey, stepCount: step_count }, 201);
});
