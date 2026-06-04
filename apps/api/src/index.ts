import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { APP_NAME } from "@meetcopilot/shared";
import { loadEnv, MissingEnvError } from "./env.js";
import { mintDeepgramToken, mintElevenLabsToken, UpstreamError } from "./tokens.js";

loadEnv();

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);

const app = new Hono();

// The Electron renderer (a different origin) fetches tokens from this local server.
app.use("*", cors());

app.get("/health", (c) =>
  c.json({ ok: true, service: `${APP_NAME} token server`, time: new Date().toISOString() }),
);

app.get("/token/deepgram", async (c) => c.json(await mintDeepgramToken()));
app.get("/token/elevenlabs", async (c) => c.json(await mintElevenLabsToken()));

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

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`[${APP_NAME}] token server listening on http://${HOST}:${info.port}`);
  console.log("  GET /health");
  console.log("  GET /token/deepgram");
  console.log("  GET /token/elevenlabs");
});
