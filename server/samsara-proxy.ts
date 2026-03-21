import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const SAMSARA_API_BASE = process.env.VITE_SAMSARA_API_BASE || "https://api.samsara.com";
const TOKEN_FILE = path.resolve(process.cwd(), ".samsara.local");
const DEFAULT_STAT_TYPES = ["gps", "obdOdometerMeters", "gpsOdometerMeters", "engineStates"] as const;

interface SamsaraPagination {
  endCursor?: string;
  hasNextPage?: boolean;
}

interface SamsaraListResponse<T> {
  data: T[];
  pagination?: SamsaraPagination;
}

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

          if (req.method === "POST" && req.url === "/api/samsara/sync") {
            const body = await readJsonBody<{ cursor?: string }>(req);
            const token = await readSavedToken();

            if (!token) {
              return sendJson(res, 400, { error: "No Samsara token has been saved on the local server." });
            }

            const [vehicleDirectory, vehicleFeed, activeDrivers, deactivatedDrivers] = await Promise.all([
              fetchPaginated("/fleet/vehicles", token),
              requestSamsara(`/fleet/vehicles/stats/feed?types=${DEFAULT_STAT_TYPES.join(",")}${body.cursor ? `&after=${encodeURIComponent(body.cursor)}` : ""}`, token),
              fetchPaginated("/fleet/drivers?driverActivationStatus=active", token),
              fetchPaginated("/fleet/drivers?driverActivationStatus=deactivated", token),
            ]);

            return sendJson(res, 200, {
              vehicleDirectory,
              vehicleFeed,
              drivers: [...activeDrivers.data, ...deactivatedDrivers.data],
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

async function fetchPaginated(pathname: string, token: string) {
  let endCursor: string | undefined;
  let hasNextPage = true;
  const data: unknown[] = [];

  while (hasNextPage) {
    const separator = pathname.includes("?") ? "&" : "?";
    const pathWithCursor = endCursor ? `${pathname}${separator}after=${encodeURIComponent(endCursor)}` : pathname;
    const page = await requestSamsara<SamsaraListResponse<unknown>>(pathWithCursor, token);
    data.push(...(page.data || []));
    endCursor = page.pagination?.endCursor;
    hasNextPage = Boolean(page.pagination?.hasNextPage && endCursor);
  }

  return {
    data,
    pagination: {
      endCursor,
      hasNextPage: false,
    },
  };
}

async function requestSamsara<T>(pathname: string, token: string): Promise<T> {
  const response = await fetch(`${SAMSARA_API_BASE}${pathname}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Samsara request failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function readSavedToken() {
  try {
    const value = await fs.readFile(TOKEN_FILE, "utf8");
    return value.trim();
  } catch {
    return "";
  }
}

async function writeSavedToken(token: string) {
  await fs.writeFile(TOKEN_FILE, token.trim(), "utf8");
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
