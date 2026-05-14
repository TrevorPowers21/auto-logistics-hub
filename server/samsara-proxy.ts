import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { readSavedToken, readSyncState, runSamsaraSync, writeSavedToken } from "./samsara-service.js";

export function samsaraProxyPlugin(): Plugin {
  return {
    name: "samsara-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/samsara")) {
          return next();
        }

        void (async () => {

        try {
          if (req.method === "GET" && req.url === "/api/samsara/token") {
            return sendJson(res, 200, {
              token: await readSavedToken(),
            });
          }

          if (req.method === "POST" && req.url === "/api/samsara/token") {
            const body = await readJsonBody<{ token?: string }>(req);
            await writeSavedToken(body.token || "");
            return sendJson(res, 200, { ok: true });
          }

          if (req.method === "GET" && req.url === "/api/samsara/status") {
            return sendJson(res, 200, {
              state: await readSyncState(),
            });
          }

          if (req.method === "POST" && req.url === "/api/samsara/sync") {
            const body = await readJsonBody<{ cursor?: string }>(req);
            const state = await runSamsaraSync({ cursor: body.cursor });

            return sendJson(res, 200, {
              vehicleDirectory: state.vehicleDirectory,
              vehicleFeed: state.vehicleFeed,
              drivers: state.drivers,
              syncedAt: state.syncedAt,
              cursor: state.cursor,
              counts: state.counts,
            });
          }

          await forwardToSamsara(req, res);
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : "Unknown Samsara proxy error",
          });
        }
        })();
      });
    },
  };
}

const SAMSARA_BASE = "https://api.samsara.com";

async function forwardToSamsara(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", "http://localhost");
  const samsaraPath = url.pathname.replace(/^\/api\/samsara/, "");

  if (!samsaraPath || samsaraPath === "/") {
    return sendJson(res, 400, { error: "Missing Samsara path" });
  }

  const auth = req.headers["authorization"];
  if (!auth || typeof auth !== "string") {
    return sendJson(res, 401, { error: "Missing Authorization header" });
  }

  const target = `${SAMSARA_BASE}${samsaraPath}${url.search}`;
  const headers: Record<string, string> = { authorization: auth };
  const contentType = req.headers["content-type"];
  if (typeof contentType === "string") headers["content-type"] = contentType;

  const init: RequestInit = { method: req.method, headers };
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    init.body = Buffer.concat(chunks).toString("utf8");
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    return sendJson(res, 502, {
      error: err instanceof Error ? err.message : "Upstream fetch failed",
    });
  }

  const body = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
  res.end(body);
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as T : {} as T;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
