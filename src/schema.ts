export interface Run {
  id: string; // uuid
  parentRunId?: string; // set if this run was spawned by another run
  parentStepId?: string; // which step in the parent spawned it
  depth: number; // 0 for root, 1 for sub-agent, 2 for sub-sub-agent...
  task: string; // what the agent was asked to do — this is your list-view label
  model: string; // e.g. "claude-sonnet-4-6"
  status: "success" | "failure" | "in_progress" | "timeout";
  startedAt: string; // ISO timestamp
  endedAt: string;
  totalTokens: { input: number; output: number };
  totalCost: number; // in USD, precompute so UI doesn't recalc
  tags: string[]; // e.g. ["baseline", "prompt-v2"] — enables your diff/filter feature
  steps: Step[];
}

export interface Step {
  id: string; // uuid, stable across re-renders
  index: number; // order in the run
  type: "model_turn" | "tool_call" | "tool_result" | "error" | "subagent_call";
  startedAt: string;
  durationMs: number;
  status: "ok" | "error";

  // present when type === "model_turn"
  modelTurn?: {
    reasoning?: string; // if you capture chain-of-thought / thinking
    text?: string; // the model's visible output
    toolCalls?: ToolCallRef[]; // what it decided to call next
    tokens: { input: number; output: number };
  };

  // present when type === "tool_call"
  toolCall?: {
    toolName: string;
    input: Record<string, unknown>;
  };

  // present when type === "tool_result"
  toolResult?: {
    toolCallId: string; // links back to the tool_call step
    output: unknown;
    error?: string;
  };

  // present when type === "subagent_call"
  subagentCall?: {
    subRunId: string; // FK to the child Run
    task: string; // what the sub-agent was asked to do
    status: "success" | "failure" | "in_progress" | "timeout"; // denormalized for quick rendering
  };
}

export interface ToolCallRef {
  id: string;
  toolName: string;
}
