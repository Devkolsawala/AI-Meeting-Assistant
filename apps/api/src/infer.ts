import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import {
  APP_NAME,
  getPersona,
  type InferContextLine,
  type InferLane,
  type InferRequest,
} from "@meetcopilot/shared";
import { AuthError } from "./auth.js";
import { getUsageSnapshot } from "./limits.js";
import { type GatewayMessage, modelForLane, streamInference } from "./model-gateway.js";
import { limitReachedResponse, requireUserId } from "./route-helpers.js";
import { captureError, captureEvent, traceLlm } from "./telemetry.js";
import { estimateCostUsd, recordInferenceEvent, type TokenUsage } from "./usage.js";

const DEFAULT_SYSTEM_PROMPT =
  "You are MeetCopilot, a real-time meeting assistant. You read a live, labelled " +
  "transcript where 'You' is the user you are helping and 'Them' is the other party. " +
  "Give the user a brief, direct, useful answer or suggestion for what to say or do " +
  "next. Be concise and specific; do not narrate the transcript.";

/** Builds the system prompt, injecting the selected persona when provided. */
function buildSystemPrompt(personaKey: string | undefined): string {
  const persona = getPersona(personaKey);
  if (!persona) {
    return DEFAULT_SYSTEM_PROMPT;
  }
  return `${persona.systemPrompt}\n\nWhen helpful, organise the answer around these notes:\n${persona.notesTemplate}`;
}

function isContextLine(value: unknown): value is InferContextLine {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const line = value as Record<string, unknown>;
  return (
    (line.speaker === "you" || line.speaker === "them") && typeof line.text === "string"
  );
}

function parseRequest(body: unknown): InferRequest | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const candidate = body as Record<string, unknown>;
  if (!Array.isArray(candidate.context) || !candidate.context.every(isContextLine)) {
    return null;
  }
  const lane: InferLane = candidate.lane === "smart" ? "smart" : "fast";
  const persona = typeof candidate.persona === "string" ? candidate.persona : undefined;
  const sessionId = typeof candidate.sessionId === "string" ? candidate.sessionId : undefined;
  return { context: candidate.context, lane, persona, sessionId };
}

function buildMessages(context: InferContextLine[]): GatewayMessage[] {
  const transcript = context
    .map((line) => `${line.speaker === "you" ? "You" : "Them"}: ${line.text}`)
    .join("\n");
  return [
    {
      role: "user",
      content: `Live meeting transcript so far:\n\n${transcript}\n\nGive me a concise, helpful response.`,
    },
  ];
}

/** POST /infer — validates the Supabase JWT and streams a Bedrock answer over SSE. */
export async function handleInfer(c: Context): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId(c);
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ error: err.message }, 401);
    }
    throw err;
  }

  const request = parseRequest(await c.req.json().catch(() => null));
  if (!request) {
    return c.json({ error: "Invalid request body: expected { context: [{ speaker, text }] }" }, 400);
  }

  // Gate every inference call server-side; never trust the client about its plan.
  const usage = await getUsageSnapshot(userId);
  if (usage.overLimit) {
    captureEvent("hit_cap", userId, { plan: usage.plan, endpoint: "infer" });
    return limitReachedResponse(c, usage);
  }

  const system = buildSystemPrompt(request.persona);
  const messages = buildMessages(request.context);
  const lane: InferLane = request.lane ?? "fast";
  const model = modelForLane(lane);
  const sessionId = request.sessionId;

  return streamSSE(c, async (stream) => {
    // Holder object: reading `usage.value` yields its declared union type, avoiding
    // the compiler keeping the initialized `null` for a closure-assigned variable.
    const usage = { value: null as TokenUsage | null };
    let answer = "";
    const startTime = new Date();
    try {
      for await (const delta of streamInference({
        system,
        messages,
        lane,
        onUsage: (u) => {
          usage.value = u;
        },
      })) {
        answer += delta;
        await stream.writeSSE({ data: JSON.stringify({ delta }) });
      }
      await stream.writeSSE({ data: "[DONE]" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${APP_NAME}] /infer stream error: ${message}`);
      captureError(err, { route: "/infer", model });
      await stream.writeSSE({ event: "error", data: JSON.stringify({ error: message }) });
    }

    const finalUsage = usage.value;

    // Trace the LLM call (cost + latency) in Langfuse.
    if (finalUsage) {
      traceLlm({
        name: "infer",
        model,
        startTime,
        endTime: new Date(),
        input: messages,
        output: answer,
        inputTokens: finalUsage.inputTokens,
        outputTokens: finalUsage.outputTokens,
        costUsd: estimateCostUsd(model, finalUsage),
        userId,
        metadata: { lane },
      });
    }

    // Best-effort metering: never let a usage write break the answer the user got.
    if (sessionId && finalUsage) {
      try {
        await recordInferenceEvent({ userId, sessionId, model, usage: finalUsage });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[${APP_NAME}] /infer usage metering error: ${message}`);
      }
    }
  });
}
