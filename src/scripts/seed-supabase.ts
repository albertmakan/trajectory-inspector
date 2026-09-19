// Seeds the Supabase project from public/data/runs.json, POSTing each run
// through the deployed ingest-run function — the same path a real run takes,
// so seeding exercises the ingest function rather than bypassing it.
//
// Run:  npm run seed

import { readFile } from "node:fs/promises";
import type { Run } from "../schema";

const url = process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  console.error(
    "Set VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in .env before seeding.",
  );
  process.exit(1);
}

const endpoint = `${url.replace(/\/$/, "")}/functions/v1/ingest-run`;
const source = new URL("../../public/data/runs.json", import.meta.url);

const runs: Run[] = JSON.parse(await readFile(source, "utf8"));

// Parents before children: runs.parent_run_id references runs.id, so a
// sub-agent run can only be inserted once the run that spawned it exists.
const ordered = [...runs].sort((a, b) => a.depth - b.depth);

const width = String(ordered.length).length;
let failed = 0;

for (const [i, run] of ordered.entries()) {
  const label = `${String(i + 1).padStart(width)}/${ordered.length} d${run.depth} ${run.id}`;

  const res = await fetch(endpoint, {
    method: "POST",
    // API keys go on `apikey`. `Authorization` is reserved for user JWTs, and a
    // secret key sent there is rejected as an invalid JWT.
    headers: {
      "Content-Type": "application/json",
      apikey: secretKey,
    },
    // This seeds the public demo dataset, so every run is scoped to it —
    // ingest would otherwise file them under the private "default" project.
    body: JSON.stringify({ ...run, project: "demo" }),
  });

  if (res.ok) {
    console.log(`ok   ${label}`);
  } else {
    failed++;
    console.error(`FAIL ${label} — ${res.status} ${(await res.text()).trim()}`);
  }
}

console.log(`\n${ordered.length - failed} of ${ordered.length} ingested`);
process.exit(failed > 0 ? 1 : 0);
