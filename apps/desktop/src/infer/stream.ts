import type { InferContextLine } from "@meetcopilot/shared";

/** Thrown when the backend rejects or fails the inference request. */
export class InferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InferError";
  }
}

export interface StreamInferOptions {
  apiBase: string;
  accessToken: string;
  context: InferContextLine[];
  /** Persona key the backend injects into the prompt. */
  persona?: string;
  signal: AbortSignal;
  /** Called for each answer text delta as it streams in. */
  onDelta: (text: string) => void;
}

/** Parses one SSE event block ("data:" / "event:" lines). Returns false on [DONE]. */
function handleSseBlock(block: string, onDelta: (text: string) => void): boolean {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }
  if (dataLines.length === 0) {
    return true;
  }
  const data = dataLines.join("\n");
  if (data === "[DONE]") {
    return false;
  }
  if (event === "error") {
    const parsed = JSON.parse(data) as { error?: string };
    throw new InferError(parsed.error ?? "Inference failed");
  }
  const parsed = JSON.parse(data) as { delta?: string };
  if (typeof parsed.delta === "string") {
    onDelta(parsed.delta);
  }
  return true;
}

/**
 * Calls the backend POST /infer with the user's bearer token and forwards each
 * streamed answer delta to {@link StreamInferOptions.onDelta}. Resolves when the
 * stream ends; rejects with {@link InferError} on auth/transport failures.
 */
export async function streamInfer(options: StreamInferOptions): Promise<void> {
  const res = await fetch(`${options.apiBase}/infer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ context: options.context, persona: options.persona }),
    signal: options.signal,
  });

  if (res.status === 401) {
    throw new InferError("Not authorized — please sign in again.");
  }
  if (!res.ok) {
    throw new InferError(`Inference request failed (HTTP ${res.status}).`);
  }
  if (!res.body) {
    throw new InferError("Inference response had no body stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      if (!handleSseBlock(block, options.onDelta)) {
        return;
      }
      separator = buffer.indexOf("\n\n");
    }
  }
}
