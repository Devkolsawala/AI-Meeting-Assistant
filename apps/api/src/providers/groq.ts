import Groq from "groq-sdk";
import type { InferLane, TurnCompleteResponse } from "@meetcopilot/shared";
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

/**
 * Server-side turn-classifier abort. Sits just under the desktop client budget
 * (TURN_COMPLETE_TIMEOUT_MS, default 650ms) so the server usually returns a real
 * verdict (or a sourced fail-open) before the client gives up and reports "timeout".
 */
const GROQ_TURN_TIMEOUT_MS = 600;

/**
 * System prompt for the end-of-turn classifier. It must answer with a single token so
 * `max_tokens: 1` is enough and latency stays minimal.
 */
const TURN_SYSTEM_PROMPT =
  "You judge whether a spoken utterance is a COMPLETE question or request, or whether " +
  "the speaker is likely mid-sentence and about to continue. Account for filler words, " +
  "trailing conjunctions, and run-on speech. Reply with exactly one token: YES (complete) " +
  "or NO (incomplete).";

/** Resolves the model used for turn-completeness classification (defaults to the fast model). */
export function groqTurnModel(): string {
  return process.env.GROQ_TURN_MODEL?.trim() || groqModelForLane("fast");
}

/**
 * Classifies whether `utterance` is a complete question/request. Reuses the shared Groq
 * client. Returns the verdict plus its source for observability. Fails OPEN (complete)
 * on an unparseable answer ("parse") or any timeout/error ("error") — better to answer
 * than to hang the overlay. The utterance is never logged (privacy default).
 *
 * Parsing is intentionally lenient (Part D #3): with max_tokens=3 the model may emit
 * "Yes"/"No"/"YES." etc., so we branch on the first non-space character only.
 */
export async function classifyTurnComplete(utterance: string): Promise<TurnCompleteResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_TURN_TIMEOUT_MS);
  try {
    const completion = await getClient().chat.completions.create(
      {
        model: groqTurnModel(),
        messages: [
          { role: "system", content: TURN_SYSTEM_PROMPT },
          { role: "user", content: utterance },
        ],
        temperature: 0,
        max_tokens: 3,
        stream: false,
      },
      { signal: controller.signal },
    );
    const first = (completion.choices[0]?.message?.content ?? "").trim()[0]?.toLowerCase();
    if (first === "n") return { complete: false, source: "groq" };
    if (first === "y") return { complete: true, source: "groq" };
    // Unparseable answer: fail open and flag the source so it's visible in debug logs.
    return { complete: true, source: "parse" };
  } catch {
    // Timeout / rate limit / API error: fail open so the overlay still answers.
    return { complete: true, source: "error" };
  } finally {
    clearTimeout(timeout);
  }
}

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
