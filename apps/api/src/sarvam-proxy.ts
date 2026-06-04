import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { APP_NAME } from "@meetcopilot/shared";
import { MissingEnvError, requireEnv } from "./env.js";

const SARVAM_WS_URL = "wss://api.sarvam.ai/speech-to-text-translate/ws";
const DEFAULT_MODEL = "saaras:v3";
const DEFAULT_MODE = "transcribe";
const SAMPLE_RATE = "16000";

export const SARVAM_PROXY_PATH = "/stt/sarvam";

/**
 * Attaches a WebSocket proxy at {@link SARVAM_PROXY_PATH}. The renderer cannot set
 * the Sarvam Api-Subscription-Key header from a browser WebSocket, so it connects
 * here and this proxy injects the key when dialing Sarvam upstream. Frames are
 * relayed verbatim in both directions; the API key never reaches the client.
 */
export function attachSarvamProxy(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const requestUrl = new URL(req.url ?? "", "http://127.0.0.1");
    if (requestUrl.pathname !== SARVAM_PROXY_PATH) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (client) => {
      bridge(client, requestUrl);
    });
  });
}

function bridge(client: WebSocket, requestUrl: URL): void {
  let apiKey: string;
  try {
    apiKey = requireEnv("SARVAM_API_KEY");
  } catch (err: unknown) {
    const message = err instanceof MissingEnvError ? err.message : "Sarvam proxy misconfigured";
    console.error(`[${APP_NAME}] sarvam proxy: ${message}`);
    client.close(1011, "Sarvam proxy misconfigured");
    return;
  }

  const upstream = new WebSocket(buildUpstreamUrl(requestUrl), {
    headers: { "Api-Subscription-Key": apiKey },
  });

  // Buffer client audio frames that arrive before the upstream socket is open.
  const pending: RawData[] = [];
  let upstreamOpen = false;

  client.on("message", (data) => {
    if (upstreamOpen) {
      upstream.send(data);
    } else {
      pending.push(data);
    }
  });
  client.on("close", (code, reason) => upstream.close(normalizeCloseCode(code), reason.toString()));
  client.on("error", () => upstream.close());

  upstream.on("open", () => {
    upstreamOpen = true;
    for (const frame of pending.splice(0, pending.length)) {
      upstream.send(frame);
    }
    console.log(`[${APP_NAME}] sarvam proxy: upstream connected`);
  });
  upstream.on("message", (data) => client.send(data));
  upstream.on("close", (code, reason) => client.close(normalizeCloseCode(code), reason.toString()));
  upstream.on("error", (err) => {
    console.error(`[${APP_NAME}] sarvam proxy upstream error: ${err.message}`);
    client.close(1011, "Sarvam upstream error");
  });
}

function buildUpstreamUrl(requestUrl: URL): string {
  const url = new URL(SARVAM_WS_URL);
  url.searchParams.set("model", DEFAULT_MODEL);
  url.searchParams.set("mode", requestUrl.searchParams.get("mode") ?? DEFAULT_MODE);
  url.searchParams.set("sample_rate", SAMPLE_RATE);
  return url.toString();
}

/** Close codes 1005/1006 are reserved and cannot be sent; fall back to a normal close. */
function normalizeCloseCode(code: number): number {
  return code === 1005 || code === 1006 ? 1000 : code;
}
