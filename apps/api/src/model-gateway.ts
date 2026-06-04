import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { InferLane } from "@meetcopilot/shared";

// LiteLLM-style routing done in-process: a lane maps to a Bedrock model id, and we
// stream tokens via the Converse API (uniform across Nova / Claude). A standalone
// gateway can later replace this module without changing the /infer route.
const DEFAULT_FAST_MODEL = "amazon.nova-lite-v1:0";
const DEFAULT_SMART_MODEL = "anthropic.claude-3-5-sonnet-20240620-v1:0";

function modelForLane(lane: InferLane): string {
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
}

/**
 * Streams answer text from Bedrock for the chosen lane. Yields text deltas as they
 * arrive; the caller forwards them to the client over SSE.
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
  }
}
