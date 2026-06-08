import type { Context } from "hono";
import { AuthError } from "./auth.js";
import { classifyTurnComplete } from "./providers/groq.js";
import { requireUserId } from "./route-helpers.js";

/** Longest utterance we will classify; anything past this is treated as complete. */
const MAX_UTTERANCE_CHARS = 2000;

function parseUtterance(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const candidate = body as Record<string, unknown>;
  const utterance = candidate.utterance;
  if (typeof utterance !== "string") return null;
  const trimmed = utterance.trim();
  return trimmed ? trimmed : null;
}

/**
 * POST /turn/complete — Layer 2 of the end-of-turn gate. Returns { complete: boolean }
 * for a single buffered utterance. Authenticated (cheap local JWT verify) so it can't
 * be used to burn Groq tokens anonymously, but NOT usage-gated: it is a tiny helper,
 * not a metered inference. The utterance is never logged (privacy default), and the
 * classifier itself fails open to `complete: true` on timeout/error.
 */
export async function handleTurnComplete(c: Context): Promise<Response> {
  try {
    await requireUserId(c);
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ error: err.message }, 401);
    }
    throw err;
  }

  const utterance = parseUtterance(await c.req.json().catch(() => null));
  if (!utterance) {
    return c.json({ error: "Invalid request body: expected { utterance: string }" }, 400);
  }

  // Over-long buffers are almost certainly complete (and not worth a classifier call).
  if (utterance.length > MAX_UTTERANCE_CHARS) {
    return c.json({ complete: true, source: "parse" });
  }

  return c.json(await classifyTurnComplete(utterance));
}
