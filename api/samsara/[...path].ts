export const config = { runtime: "edge" };

const SAMSARA_BASE = "https://api.samsara.com";

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const samsaraPath = url.pathname.replace(/^\/api\/samsara/, "");

  if (!samsaraPath || samsaraPath === "/") {
    return json({ error: "Missing Samsara path" }, 400);
  }

  const auth = req.headers.get("authorization");
  if (!auth) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const target = `${SAMSARA_BASE}${samsaraPath}${url.search}`;
  const headers: Record<string, string> = { authorization: auth };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Upstream fetch failed" }, 502);
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
