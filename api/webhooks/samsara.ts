import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.SAMSARA_WEBHOOK_SECRET || "";

function verifySignature(rawBody: string, signature: string | undefined): boolean {
  if (!SECRET || !signature) return false;
  const expected = createHmac("sha256", SECRET).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface SamsaraWebhookEvent {
  eventId?: string;
  eventType?: string;
  eventTime?: string;
  orgId?: string;
  data?: Record<string, unknown>;
}

export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = await readRawBody(req);
  const sigHeader = req.headers["x-samsara-signature"];
  const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

  if (SECRET) {
    if (!verifySignature(raw, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  let event: SamsaraWebhookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  console.log("samsara.webhook", {
    eventId: event.eventId,
    eventType: event.eventType,
    eventTime: event.eventTime,
    orgId: event.orgId,
  });

  return res.status(200).json({ received: true });
}
