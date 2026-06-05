import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { APP_NAME } from "@meetcopilot/shared";
import { AuthError } from "./auth.js";
import { loadEnv, MissingEnvError } from "./env.js";
import { handleInfer } from "./infer.js";
import { getUsageSnapshot } from "./limits.js";
import { limitReachedResponse, requireUserId } from "./route-helpers.js";
import { attachSarvamProxy, SARVAM_PROXY_PATH } from "./sarvam-proxy.js";
import { handleSessionEnd, handleSessionStart } from "./sessions.js";
import { captureError, captureEvent } from "./telemetry.js";
import { mintDeepgramToken, mintElevenLabsToken, UpstreamError } from "./tokens.js";

loadEnv();

// Crash reporting: surface otherwise-silent process failures to Sentry.
process.on("unhandledRejection", (reason) => captureError(reason, { kind: "unhandledRejection" }));
process.on("uncaughtException", (err) => captureError(err, { kind: "uncaughtException" }));

// Bind to loopback in local dev; the container (App Runner) sets HOST=0.0.0.0 so
// the service is reachable. PORT is configurable for the hosting platform.
const HOST = process.env.HOST?.trim() || "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);

const app = new Hono();

// The Electron renderer (a different origin) calls this local server. Allow the
// Authorization header so /infer can receive the user's Supabase access token.
app.use("*", cors({ allowHeaders: ["Authorization", "Content-Type"], allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/health", (c) =>
  c.json({ ok: true, service: `${APP_NAME} backend`, time: new Date().toISOString() }),
);

app.get("/token/deepgram", async (c) => c.json(await mintDeepgramToken()));
app.get("/token/elevenlabs", async (c) => c.json(await mintElevenLabsToken()));

// Short-lived Deepgram token for the desktop STT stream. Authenticated and gated:
// a user over their plan cap is blocked here, before any STT token is issued.
app.post("/stt-token", async (c) => {
  let userId: string;
  try {
    userId = await requireUserId(c);
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ error: err.message }, 401);
    }
    throw err;
  }
  const usage = await getUsageSnapshot(userId);
  if (usage.overLimit) {
    captureEvent("hit_cap", userId, { plan: usage.plan, endpoint: "stt-token" });
    return limitReachedResponse(c, usage);
  }
  return c.json(await mintDeepgramToken());
});

// Authenticated usage snapshot for the web dashboard (plan, usage, caps).
app.get("/usage", async (c) => {
  let userId: string;
  try {
    userId = await requireUserId(c);
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ error: err.message }, 401);
    }
    throw err;
  }
  return c.json(await getUsageSnapshot(userId));
});

// Authenticated usage-session lifecycle (metering).
app.post("/session/start", handleSessionStart);
app.post("/session/end", handleSessionEnd);

// Authenticated streaming inference (SSE).
app.post("/infer", handleInfer);

app.onError((err, c) => {
  if (err instanceof UpstreamError) {
    console.error(`[${APP_NAME}] ${err.provider} upstream error ${err.status}: ${err.detail}`);
    return c.json({ error: `${err.provider} token request failed`, status: err.status }, 502);
  }
  if (err instanceof MissingEnvError) {
    console.error(`[${APP_NAME}] ${err.message}`);
    return c.json({ error: err.message }, 500);
  }
  console.error(`[${APP_NAME}] unexpected error:`, err);
  captureError(err, { kind: "onError" });
  return c.json({ error: "Internal server error" }, 500);
});

const server = serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`[${APP_NAME}] backend listening on http://${HOST}:${info.port}`);
  console.log("  GET  /health");
  console.log("  POST /stt-token (Deepgram)");
  console.log("  GET  /usage     (auth + plan/usage snapshot)");
  console.log("  POST /session/start | /session/end (auth + usage metering)");
  console.log("  POST /infer     (auth + Bedrock SSE)");
  console.log("  GET  /token/deepgram");
  console.log("  GET  /token/elevenlabs");
  console.log(`  WS   ${SARVAM_PROXY_PATH} (Sarvam saaras:v3 proxy)`);
});

attachSarvamProxy(server as Server);
