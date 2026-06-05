import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { InferLane } from "@meetcopilot/shared";
import type { TokenUsage } from "./usage.js";

// LiteLLM-style routing done in-process: a lane maps to a Bedrock model id, and we
// stream tokens via the Converse API (uniform across Nova / Claude). A standalone
// gateway can later replace this module without changing the /infer route.
const DEFAULT_FAST_MODEL = "amazon.nova-lite-v1:0";
const DEFAULT_SMART_MODEL = "anthropic.claude-3-5-sonnet-20240620-v1:0";

/** Resolves a lane to the concrete Bedrock model id used for the request. */
export function modelForLane(lane: InferLane): string {
  if (lane === "smart") {
    return process.env.BEDROCK_SMART_MODEL_ID?.trim() || DEFAULT_SMART_MODEL;
  }
  return process.env.BEDROCK_FAST_MODEL_ID?.trim() || DEFAULT_FAST_MODEL;
}

let client: BedrockRuntimeClient | null = null;
function getClient(): BedrockRuntimeClient {
  client ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION?.trim() || "us-east-1" });
  return client;
}

/** A single conversation turn passed to the model. */
export interface GatewayMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamInferenceParams {
  system: string;
  messages: GatewayMessage[];
  lane: InferLane;
  /** Invoked once when Bedrock reports token usage for the completed stream. */
  onUsage?: (usage: TokenUsage) => void;
}

/**
 * Streams answer text from Bedrock for the chosen lane. Yields text deltas as they
 * arrive; the caller forwards them to the client over SSE. When Bedrock emits its
 * end-of-stream metadata, {@link StreamInferenceParams.onUsage} is called with the
 * input/output token counts for usage metering.
 */
export async function* streamInference(
  params: StreamInferenceParams,
): AsyncGenerator<string, void, unknown> {
  const command = new ConverseStreamCommand({
    modelId: modelForLane(params.lane),
    system: [{ text: params.system }],
    messages: params.messages.map((m) => ({ role: m.role, content: [{ text: m.content }] })),
    inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
  });

  const response = await getClient().send(command);
  if (!response.stream) {
    return;
  }
  for await (const event of response.stream) {
    const delta = event.contentBlockDelta?.delta?.text;
    if (delta) {
      yield delta;
    }
    const usage = event.metadata?.usage;
    if (usage && params.onUsage) {
      params.onUsage({
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      });
    }
  }
}
