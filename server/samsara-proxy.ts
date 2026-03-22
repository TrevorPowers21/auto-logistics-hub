import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { readSavedToken, readSyncState, runSamsaraSync, writeSavedToken } from "./samsara-service.js";

export function samsaraProxyPlugin(): Plugin {
  return {
    name: "samsara-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/samsara")) {
          next();
          return;
        }

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

          sendJson(res, 404, { error: "Not found" });
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : "Unknown Samsara proxy error",
          });
        }
      });
    },
  };
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
