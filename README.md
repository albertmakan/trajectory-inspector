# Trajectory Inspector

A web interface for inspecting AI agent trajectories — the step-by-step logs of an LLM agent's execution, including model reasoning, tool calls, tool results, errors, and (eventually) sub-agent delegation.

Built as an exploration of the same class of problem AI infrastructure teams face: turning the opaque, sequential/tree-shaped artifacts produced by model training and agent execution (experiments, trajectories, evals) into interfaces people can actually trust and scan quickly.

## Why this exists

Most agent debugging today happens by scrolling raw JSON logs or a flat chat transcript. Neither makes it easy to answer the questions that actually matter when developing or evaluating an agent:

- Where in a 50-step run did things go wrong?
- How did this run differ from a previous attempt at the same task?
- What did a sub-agent actually do, and did it succeed?
- How much did this run cost, and where did the cost concentrate?

This project is a small, focused attempt at answering those questions visually.

## Core views

**Run Timeline** — the primary view. A vertical, scannable log of a single run's steps: model turns (reasoning + decision to call tools), tool calls, tool results, and errors. Steps are visually distinct by type; failures are designed to be spottable at a glance even in a long run. Tool inputs/outputs default to collapsed (often verbose JSON); model reasoning defaults to expanded.

**Run List** — a filterable table of runs (task, model, status, duration, cost, tags), with an option to show or hide sub-agent runs separately from top-level runs.

**Run Diff** — two runs shown side by side, aligned step-by-step, with divergence highlighted. Built on a sequence-alignment approach (see below) rather than naive positional comparison, so an inserted retry step doesn't desync the entire comparison.

**Call Graph** — a tree view of which run spawned which sub-agent run, how deep delegation went, and where in the tree a failure originated.

## Data model

A `Run` is one full agent execution (top-level or sub-agent). A `Run` contains an ordered list of `Step`s. Each `Step` is one of: a model turn, a tool call, a tool result, an error, or a sub-agent call.

```typescript
interface Run {
  id: string;
  parentRunId?: string; // set if this run was spawned by another run
  parentStepId?: string; // which step in the parent spawned it
  depth: number; // 0 = top-level, 1 = sub-agent, ...
  task: string;
  model: string;
  status: "success" | "failure" | "in_progress" | "timeout";
  startedAt: string;
  endedAt: string;
  totalTokens: { input: number; output: number };
  totalCost: number; // includes rolled-up cost of descendant sub-agent runs
  tags: string[];
  steps: Step[];
}

interface Step {
  id: string;
  index: number;
  type: "model_turn" | "tool_call" | "tool_result" | "error" | "subagent_call";
  startedAt: string;
  durationMs: number;
  status: "ok" | "error";

  modelTurn?: {
    reasoning?: string;
    text?: string;
    toolCalls?: { id: string; toolName: string }[];
    tokens: { input: number; output: number };
  };

  toolCall?: {
    toolName: string;
    input: Record<string, unknown>;
  };

  toolResult?: {
    toolCallId: string;
    output: unknown;
    error?: string;
  };

  subagentCall?: {
    subRunId: string; // FK to the child Run
    task: string;
    status: "success" | "failure" | "in_progress" | "timeout";
  };
}
```

Design choices worth calling out:

- **Steps are a flat, ordered array**, not a nested tree, mirroring how real agent frameworks (LangChain, the Assistants API) emit traces and keeping the alignment/diff logic simpler.
- **Sub-agent calls reference a separate `Run`** rather than inlining the child's steps into the parent's array, so any `Run` is independently renderable and the parent/child relationship is a graph you can walk rather than steps at mixed depths.
- **Cost and duration live on every step**, not just the run, enabling "which step was the bottleneck" as a first-class view.
- **Tags on `Run`** make run filtering and diffing (e.g. "compare all `prompt-v2` runs that failed") a query, not a schema change.

## Diff algorithm

Two runs are aligned using an LCS-based sequence alignment (the same family of algorithm behind `git diff`), with a custom equality function — two steps are considered a match if their `type` and (where applicable) `toolName` correspond, rather than requiring byte-identical fields. This handles the common case where one run has an extra retry or a differently-ordered tool call without desynchronizing the rest of the comparison.

Within each aligned pair of steps, a field-level diff highlights what actually changed (tool input, output, duration, reasoning text).

For runs involving sub-agents, alignment extends recursively: `subagent_call` steps are matched by task similarity, and their child `Run`s are diffed the same way, rolling up into a "this sub-agent's execution differed" indicator on the parent view.

Considered and deliberately not used for the initial version: naive positional (index-to-index) diffing, which breaks under any insertion/deletion; and embedding-based semantic matching, which would better handle paraphrased reasoning steps but adds real cost/latency and fuzzy threshold-tuning that's out of scope for a first pass.

## Data sources

The app is designed against a stable internal schema (`Run`/`Step`) with adapters translating from whatever produced the data, so the UI never depends on a specific source format.

- **Synthetic data**, generated via the Claude API, used during UI design to get realistic-shaped data without a live integration.
- **Instrumented tool-loop script** (`/scripts/run-agent.ts`), a small script that calls the Claude API with tools and logs every step directly in the `Run`/`Step` shape — the primary real data source.
- Designed to extend to sub-agent delegation (one instrumented run spawning another) and, longer-term, adapters for trace formats from existing agent frameworks.

## Tech stack

- **Frontend**: Next.js, React
- **Data / auth**: Supabase (or AWS Lambda + S3, depending on deployment target)
- **Instrumentation**: TypeScript script using the Anthropic SDK
- **Design**: prototyped in Claude Design, handed off to Claude Code for production implementation

## Status

Actively in progress — schema and instrumentation defined, Timeline view in development. Full recursive diff are scoped but not yet built.

## Possible next steps

- Recursive diff for sub-agent runs
- Adapter for LangChain/LangGraph trace format
- Semantic (embedding-based) step matching for paraphrased reasoning
