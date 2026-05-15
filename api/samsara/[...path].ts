import type { VercelRequest, VercelResponse } from "@vercel/node";

const SAMSARA_BASE = "https://api.samsara.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawUrl = req.url || "";
  // Strip the /api/samsara prefix to get the Samsara path
  const samsaraPath = rawUrl.replace(/^\/api\/samsara/, "");

  if (!samsaraPath || samsaraPath === "/") {
    return res.status(400).json({ error: "Missing Samsara path" });
  }

  const authRaw = req.headers["authorization"];
  const auth = Array.isArray(authRaw) ? authRaw[0] : authRaw;
  if (!auth) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const target = `${SAMSARA_BASE}${samsaraPath}`;
  const headers: Record<string, string> = { authorization: auth };
  const contentType = req.headers["content-type"];
  if (typeof contentType === "string") headers["content-type"] = contentType;

  const init: RequestInit = { method: req.method, headers };
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
    res.send(body);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Upstream fetch failed" });
  }
}
