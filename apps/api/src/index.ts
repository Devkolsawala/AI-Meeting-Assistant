import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { APP_NAME } from "@meetcopilot/shared";
import { loadEnv, MissingEnvError } from "./env.js";
import { handleInfer } from "./infer.js";
import { attachSarvamProxy, SARVAM_PROXY_PATH } from "./sarvam-proxy.js";
import { mintDeepgramToken, mintElevenLabsToken, UpstreamError } from "./tokens.js";

loadEnv();

const HOST = "127.0.0.1";
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

// Short-lived Deepgram token for the desktop STT stream (Phase 0 logic, now POST).
app.post("/stt-token", async (c) => c.json(await mintDeepgramToken()));

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
  return c.json({ error: "Internal server error" }, 500);
});

const server = serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`[${APP_NAME}] backend listening on http://${HOST}:${info.port}`);
  console.log("  GET  /health");
  console.log("  POST /stt-token (Deepgram)");
  console.log("  POST /infer     (auth + Bedrock SSE)");
  console.log("  GET  /token/deepgram");
  console.log("  GET  /token/elevenlabs");
  console.log(`  WS   ${SARVAM_PROXY_PATH} (Sarvam saaras:v3 proxy)`);
});

attachSarvamProxy(server as Server);
