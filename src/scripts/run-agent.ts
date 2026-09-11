import Anthropic from "@anthropic-ai/sdk";
import type { ToolUnion } from "@anthropic-ai/sdk/resources";
import { randomUUID } from "crypto";
import type { Run } from "../schema";

const anthropic = new Anthropic();

// --- Tool definitions -------------------------------------------------

const tools: ToolUnion[] = [
  {
    name: "search_docs",
    description: "Search internal documentation",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "run_calculator",
    description: "Evaluate a math expression",
    input_schema: {
      type: "object",
      properties: { expression: { type: "string" } },
      required: ["expression"],
    },
  },
];

// Fake implementations — swap for real ones later
async function executeTool(name: string, input: any): Promise<unknown> {
  if (name === "search_docs")
    return { results: [`Doc snippet for "${input.query}"`] };
  if (name === "run_calculator") return { result: eval(input.expression) };
  throw new Error(`Unknown tool: ${name}`);
}

// --- Instrumented loop --------------------------------------------------

async function runAgent(
  task: string,
  model = "claude-sonnet-4-6",
): Promise<Run> {
  const run: Run = {
    id: randomUUID(),
    task,
    model,
    status: "in_progress",
    startedAt: new Date().toISOString(),
    endedAt: "",
    totalTokens: { input: 0, output: 0 },
    totalCost: 0,
    tags: ["instrumented-v1"],
    steps: [],
    depth: 1,
  };

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];
  let stepIndex = 0;

  for (let turn = 0; turn < 10; turn++) {
    const stepStart = Date.now();

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      tools,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    // Log the model turn
    run.steps.push({
      id: randomUUID(),
      index: stepIndex++,
      type: "model_turn",
      startedAt: new Date(stepStart).toISOString(),
      durationMs: Date.now() - stepStart,
      status: "ok",
      modelTurn: {
        text: textBlock?.type === "text" ? textBlock.text : undefined,
        toolCalls: toolUseBlocks.map((t) => ({ id: t.id, toolName: t.name })),
        tokens: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      },
    });
    run.totalTokens.input += response.usage.input_tokens;
    run.totalTokens.output += response.usage.output_tokens;

    messages.push({ role: "assistant", content: response.content });

    if (toolUseBlocks.length === 0) {
      // Model gave a final answer, no more tools to call
      run.status = "success";
      break;
    }

    // Execute each requested tool, logging call + result as separate steps
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      run.steps.push({
        id: randomUUID(),
        index: stepIndex++,
        type: "tool_call",
        startedAt: new Date().toISOString(),
        durationMs: 0,
        status: "ok",
        toolCall: {
          toolName: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
        },
      });

      const callStart = Date.now();
      try {
        const output = await executeTool(toolUse.name, toolUse.input);
        run.steps.push({
          id: randomUUID(),
          index: stepIndex++,
          type: "tool_result",
          startedAt: new Date().toISOString(),
          durationMs: Date.now() - callStart,
          status: "ok",
          toolResult: { toolCallId: toolUse.id, output },
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(output),
        });
      } catch (err: any) {
        run.steps.push({
          id: randomUUID(),
          index: stepIndex++,
          type: "tool_result",
          startedAt: new Date().toISOString(),
          durationMs: Date.now() - callStart,
          status: "error",
          toolResult: {
            toolCallId: toolUse.id,
            output: null,
            error: err.message,
          },
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: err.message,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  run.endedAt = new Date().toISOString();
  if (run.status === "in_progress") run.status = "timeout"; // hit the turn limit
  return run;
}
