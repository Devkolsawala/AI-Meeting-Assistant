import Groq from "groq-sdk";
import type { InferLane } from "@meetcopilot/shared";
import type { StreamInferenceParams } from "../model-gateway.js";

// Groq is the primary inference provider (fast, OpenAI-compatible streaming). It
// mirrors the Bedrock gateway's contract exactly — same StreamInferenceParams in,
// same `AsyncGenerator<string>` of text deltas out, same onUsage callback — so the
// /infer route can treat Groq and Bedrock interchangeably and fall back cleanly.

// Fast lane = Llama 3.3 70B (versatile); smart lane uses the same model today but
// is kept as a separate knob so it can diverge without touching callers.
const DEFAULT_FAST_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_SMART_MODEL = "llama-3.3-70b-versatile";

/** Calls fail (and trigger Bedrock fallback) if no token arrives within this window. */
const GROQ_TIMEOUT_MS = 15_000;

/** Resolves a lane to the concrete Groq model id used for the request. */
export function groqModelForLane(lane: InferLane): string {
  if (lane === "smart") {
    return process.env.GROQ_SMART_MODEL?.trim() || DEFAULT_SMART_MODEL;
  }
  return process.env.GROQ_FAST_MODEL?.trim() || DEFAULT_FAST_MODEL;
}

let client: Groq | null = null;
function getClient(): Groq {
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  client ??= new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });
  return client;
}

/**
 * Streams answer text from Groq for the chosen lane. Yields text deltas as they
 * arrive; when Groq reports token usage on the final chunk, {@link
 * StreamInferenceParams.onUsage} is called with the input/output token counts.
 * Aborts (and throws) if no completion finishes within {@link GROQ_TIMEOUT_MS}.
 *
 * The optional `model` argument overrides the lane-derived model id.
 */
export async function* streamGroq(
  params: StreamInferenceParams,
  model?: string,
): AsyncGenerator<string, void, unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  try {
    const stream = await getClient().chat.completions.create(
      {
        model: model ?? groqModelForLane(params.lane),
        messages: [
          { role: "system", content: params.system },
          ...params.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.3,
      },
      { signal: controller.signal },
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
      // Groq reports token usage on the final chunk under the x_groq extension.
      const usage = chunk.x_groq?.usage;
      if (usage && params.onUsage) {
        params.onUsage({
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
        });
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}
