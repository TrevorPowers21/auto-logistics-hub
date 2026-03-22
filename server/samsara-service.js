import fs from "node:fs/promises";
import path from "node:path";

const SAMSARA_API_BASE = process.env.VITE_SAMSARA_API_BASE || "https://api.samsara.com";
const TOKEN_FILE = path.resolve(process.cwd(), ".samsara.local");
const DATA_DIR = path.resolve(process.cwd(), "server/data");
const SYNC_STATE_FILE = path.resolve(DATA_DIR, "samsara-sync.json");
const DEFAULT_STAT_TYPES = ["gps", "obdOdometerMeters", "gpsOdometerMeters", "engineStates"];

export async function readSavedToken() {
  try {
    const value = await fs.readFile(TOKEN_FILE, "utf8");
    return value.trim();
  } catch {
    return "";
  }
}

export async function writeSavedToken(token) {
  await fs.writeFile(TOKEN_FILE, token.trim(), "utf8");
}

export async function readSyncState() {
  try {
    const raw = await fs.readFile(SYNC_STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function runSamsaraSync({ cursor } = {}) {
  const token = await readSavedToken();

  if (!token) {
    throw new Error("No Samsara token has been saved on the local server.");
  }

  const priorState = await readSyncState();
  const effectiveCursor = cursor ?? priorState?.cursor ?? "";

  const [vehicleDirectory, vehicleFeed, activeDrivers, deactivatedDrivers] = await Promise.all([
    fetchPaginated("/fleet/vehicles", token),
    requestSamsara(`/fleet/vehicles/stats/feed?types=${DEFAULT_STAT_TYPES.join(",")}${effectiveCursor ? `&after=${encodeURIComponent(effectiveCursor)}` : ""}`, token),
    fetchPaginated("/fleet/drivers?driverActivationStatus=active", token),
    fetchPaginated("/fleet/drivers?driverActivationStatus=deactivated", token),
  ]);

  const state = {
    syncedAt: new Date().toISOString(),
    cursor: vehicleFeed.pagination?.endCursor || effectiveCursor || "",
    counts: {
      vehicles: vehicleDirectory.data.length,
      driverFeedItems: activeDrivers.data.length + deactivatedDrivers.data.length,
      vehicleFeedItems: vehicleFeed.data?.length || 0,
    },
    vehicleDirectory,
    vehicleFeed,
    drivers: [...activeDrivers.data, ...deactivatedDrivers.data],
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2), "utf8");

  return state;
}

async function fetchPaginated(pathname, token) {
  let endCursor;
  let hasNextPage = true;
  const data = [];

  while (hasNextPage) {
    const separator = pathname.includes("?") ? "&" : "?";
    const pathWithCursor = endCursor ? `${pathname}${separator}after=${encodeURIComponent(endCursor)}` : pathname;
    const page = await requestSamsara(pathWithCursor, token);
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

async function requestSamsara(pathname, token) {
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

  return response.json();
}
