import {
  generateId,
  getAppSetting,
  getDrivers,
  getVehicles,
  saveAppSetting,
  saveDrivers,
  saveVehicles,
} from "@/lib/store";
import { Driver, DriverStatus, Vehicle } from "@/lib/types";
import { decodeVin } from "@/lib/vin";

const DEFAULT_STAT_TYPES = ["gps", "obdOdometerMeters", "gpsOdometerMeters", "engineStates"] as const;

type SamsaraStatType = (typeof DEFAULT_STAT_TYPES)[number];

interface SamsaraPagination {
  endCursor?: string;
  hasNextPage?: boolean;
}

interface SamsaraExternalIds {
  [key: string]: string | undefined;
}

interface SamsaraGpsPoint {
  time: string;
  latitude?: number;
  longitude?: number;
  speedMilesPerHour?: number;
  reverseGeo?: {
    formattedLocation?: string;
  };
}

interface SamsaraNumericPoint {
  time: string;
  value?: number;
}

interface SamsaraEngineStatePoint {
  time: string;
  value?: string;
}

interface SamsaraVehicleFeedItem {
  id: string;
  name?: string;
  externalIds?: SamsaraExternalIds;
  gps?: SamsaraGpsPoint[];
  obdOdometerMeters?: SamsaraNumericPoint[];
  gpsOdometerMeters?: SamsaraNumericPoint[];
  engineStates?: SamsaraEngineStatePoint[];
}

interface SamsaraVehicleDirectoryItem {
  id: string;
  name?: string;
  vin?: string;
  licensePlate?: string;
  externalIds?: SamsaraExternalIds;
}

interface SamsaraDriverItem {
  id: string;
  name: string;
  username?: string;
  timezone?: string;
  updatedAtTime?: string;
  createdAtTime?: string;
  driverActivationStatus?: "active" | "deactivated";
  externalIds?: SamsaraExternalIds;
}

interface SamsaraListResponse<T> {
  data: T[];
  pagination?: SamsaraPagination;
}

export interface SamsaraVehicleStatsFeedResponse extends SamsaraListResponse<SamsaraVehicleFeedItem> {}
export interface SamsaraVehicleDirectoryResponse extends SamsaraListResponse<SamsaraVehicleDirectoryItem> {}
export interface SamsaraDriversResponse extends SamsaraListResponse<SamsaraDriverItem> {}

export interface SamsaraTrip {
  id: string;
  vehicle?: { id: string; name?: string };
  driver?: { id: string; name?: string };
  startTime?: string;
  endTime?: string;
  startMs?: number;
  endMs?: number;
  startLocation?: string;
  endLocation?: string;
  startCoordinates?: { latitude: number; longitude: number };
  endCoordinates?: { latitude: number; longitude: number };
  distanceMeters?: number;
  startOdometer?: number;
  endOdometer?: number;
  durationMs?: number;
  fuelConsumedMl?: number;
  averageSpeedMilesPerHour?: number;
  maxSpeedMilesPerHour?: number;
}

export interface SamsaraTripsResponse extends SamsaraListResponse<SamsaraTrip> {}

export interface SamsaraFleetSyncResult {
  vehicles: Vehicle[];
  drivers: Driver[];
  importedVehicleCount: number;
  updatedVehicleCount: number;
  importedDriverCount: number;
  updatedDriverCount: number;
  endCursor?: string;
}

export async function getSavedSamsaraToken() {
  return getAppSetting("samsara_token") || "";
}

export async function saveSamsaraToken(token: string) {
  saveAppSetting("samsara_token", token.trim());
}

export function isSamsaraConfigured(token?: string | null) {
  return Boolean(token);
}

const METERS_PER_MILE = 1609.344;

export function metersToMiles(meters?: number): number {
  return meters ? meters / METERS_PER_MILE : 0;
}

export function fmtMiles(meters?: number): string {
  if (meters == null) return "—";
  return `${Math.round(metersToMiles(meters))} mi`;
}

export function fmtDuration(ms?: number): string {
  if (!ms) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Modern Samsara trips endpoint: /trips/stream
 * - Batched (up to 50 vehicle IDs per call)
 * - RFC 3339 startTime (no endTime — stream returns up to now)
 * - Requires "Read Trips" scope under the Trips category
 *
 * Replaces the deprecated /v1/fleet/trips path.
 */
interface SamsaraStreamTripRaw {
  tripStartTime?: string;
  tripEndTime?: string;
  asset?: { id?: string; name?: string };
  driver?: { id?: string; name?: string };
  startLocation?: {
    latitude?: number;
    longitude?: number;
    address?: {
      streetNumber?: string;
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
  endLocation?: {
    latitude?: number;
    longitude?: number;
    address?: {
      streetNumber?: string;
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
  completionStatus?: string;
}

interface SamsaraStreamTripsResponse {
  data?: SamsaraStreamTripRaw[];
  pagination?: SamsaraPagination;
}

function formatAddress(loc?: SamsaraStreamTripRaw["endLocation"]): string | undefined {
  if (!loc?.address) return undefined;
  const a = loc.address;
  const parts = [
    [a.streetNumber, a.street].filter(Boolean).join(" "),
    a.city,
    a.state,
  ].filter((p) => p && p.length > 0);
  return parts.join(", ") || undefined;
}

function normalizeStreamTrip(raw: SamsaraStreamTripRaw, idx: number): SamsaraTrip {
  const startMs = raw.tripStartTime ? Date.parse(raw.tripStartTime) : undefined;
  const endMs = raw.tripEndTime ? Date.parse(raw.tripEndTime) : undefined;
  const durationMs = startMs && endMs ? endMs - startMs : undefined;
  return {
    id: `${raw.asset?.id ?? "unknown"}-${raw.tripStartTime ?? idx}`,
    vehicle: raw.asset?.id ? { id: raw.asset.id, name: raw.asset.name } : undefined,
    driver: raw.driver?.id ? { id: raw.driver.id, name: raw.driver.name } : undefined,
    startTime: raw.tripStartTime,
    endTime: raw.tripEndTime,
    startMs,
    endMs,
    startLocation: formatAddress(raw.startLocation),
    endLocation: formatAddress(raw.endLocation),
    startCoordinates: raw.startLocation?.latitude != null && raw.startLocation?.longitude != null
      ? { latitude: raw.startLocation.latitude, longitude: raw.startLocation.longitude }
      : undefined,
    endCoordinates: raw.endLocation?.latitude != null && raw.endLocation?.longitude != null
      ? { latitude: raw.endLocation.latitude, longitude: raw.endLocation.longitude }
      : undefined,
    durationMs,
  };
}

async function fetchTripsStreamBatch(ids: string[], startTime: string, token: string): Promise<SamsaraTrip[]> {
  const params = new URLSearchParams({
    startTime,
    ids: ids.join(","),
  });
  const trips: SamsaraTrip[] = [];
  let cursor: string | undefined;
  while (true) {
    const url = `/trips/stream?${params.toString()}${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`;
    try {
      const res = await samsaraFetch<SamsaraStreamTripsResponse>(url, token);
      const raws = res.data ?? [];
      trips.push(...raws.map((raw, i) => normalizeStreamTrip(raw, trips.length + i)));
      if (!res.pagination?.hasNextPage || !res.pagination.endCursor) break;
      cursor = res.pagination.endCursor;
    } catch (err) {
      console.warn(`Samsara trips stream batch failed:`, err);
      break;
    }
  }
  return trips;
}

/**
 * Fetch Samsara-detected trips for a given time window across a list of vehicles.
 * Samsara returns trips that have COMPLETED — in-progress trips don't appear here.
 * Batches calls so we never exceed Samsara's 50-id-per-request limit.
 */
export async function fetchSamsaraTrips(opts: {
  startMs: number;
  endMs: number;
  vehicleIds: string[];
}): Promise<SamsaraTrip[]> {
  const token = await getSavedSamsaraToken();
  if (!token) throw new Error("No Samsara token configured");
  if (opts.vehicleIds.length === 0) return [];

  const startTime = new Date(opts.startMs).toISOString();
  const batches: string[][] = [];
  for (let i = 0; i < opts.vehicleIds.length; i += 50) {
    batches.push(opts.vehicleIds.slice(i, i + 50));
  }
  const tripsPerBatch = await Promise.all(batches.map((batch) => fetchTripsStreamBatch(batch, startTime, token)));
  // Stream endpoint has no endMs — filter client-side to the requested window
  return tripsPerBatch.flat().filter((trip) => {
    const tripEnd = trip.endMs ?? (trip.endTime ? Date.parse(trip.endTime) : 0);
    return tripEnd <= opts.endMs;
  });
}

/** Get the most recent completed trip for a single vehicle, looking back N hours (default 48). */
export async function fetchLastTripForVehicle(vehicleExternalId: string, lookbackHours = 48): Promise<SamsaraTrip | null> {
  const endMs = Date.now();
  const startMs = endMs - lookbackHours * 60 * 60 * 1000;
  const trips = await fetchSamsaraTrips({
    startMs,
    endMs,
    vehicleIds: [vehicleExternalId],
  });
  if (trips.length === 0) return null;
  return [...trips].sort((a, b) => {
    const aEnd = a.endMs ?? (a.endTime ? Date.parse(a.endTime) : 0);
    const bEnd = b.endMs ?? (b.endTime ? Date.parse(b.endTime) : 0);
    return bEnd - aEnd;
  })[0];
}

const SAMSARA_API_BASE = "/api/samsara";

async function samsaraFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${SAMSARA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errObj = err as { message?: string; samsaraStatus?: number; samsaraBody?: string };
    const msg = errObj.message;
    const samsaraBody = errObj.samsaraBody;
    const pathHint = path.split("?")[0];
    if (samsaraBody) {
      throw new Error(`${pathHint} → Samsara ${errObj.samsaraStatus || res.status}: ${samsaraBody}`);
    }
    throw new Error(msg ? `${pathHint}: ${msg}` : `${pathHint} → Samsara API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface SamsaraHosClocks {
  driverId: string;
  driverName?: string;
  driveRemainingMs?: number;
  shiftRemainingMs?: number;
  cycleRemainingMs?: number;
  breakRemainingMs?: number;
  dutyStatus?: string;
  vehicleId?: string;
}

interface SamsaraDurationRaw {
  value?: number;
  unit?: string;
}

interface SamsaraHosClockRaw {
  driver?: { id?: string; name?: string };
  drive?: { remaining?: SamsaraDurationRaw };
  shift?: { remaining?: SamsaraDurationRaw };
  cycle?: { remaining?: SamsaraDurationRaw };
  break?: { remaining?: SamsaraDurationRaw };
  currentDutyStatus?: string;
  currentVehicle?: { id?: string };
}

interface SamsaraHosClocksResponse {
  data?: SamsaraHosClockRaw[];
  pagination?: SamsaraPagination;
}

function durationToMs(d?: SamsaraDurationRaw): number | undefined {
  if (!d || d.value == null) return undefined;
  const unit = (d.unit || "milliseconds").toLowerCase();
  if (unit === "milliseconds") return d.value;
  if (unit === "seconds") return d.value * 1000;
  if (unit === "minutes") return d.value * 60_000;
  if (unit === "hours") return d.value * 3_600_000;
  return d.value;
}

export async function fetchSamsaraHosClocks(): Promise<SamsaraHosClocks[]> {
  const token = await getSavedSamsaraToken();
  if (!token) return [];
  const out: SamsaraHosClocks[] = [];
  let cursor: string | undefined;
  while (true) {
    const url = `/fleet/hos/clocks${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`;
    try {
      const res = await samsaraFetch<SamsaraHosClocksResponse>(url, token);
      for (const raw of res.data ?? []) {
        if (!raw.driver?.id) continue;
        out.push({
          driverId: raw.driver.id,
          driverName: raw.driver.name,
          driveRemainingMs: durationToMs(raw.drive?.remaining),
          shiftRemainingMs: durationToMs(raw.shift?.remaining),
          cycleRemainingMs: durationToMs(raw.cycle?.remaining),
          breakRemainingMs: durationToMs(raw.break?.remaining),
          dutyStatus: raw.currentDutyStatus,
          vehicleId: raw.currentVehicle?.id,
        });
      }
      if (!res.pagination?.hasNextPage || !res.pagination.endCursor) break;
      cursor = res.pagination.endCursor;
    } catch (err) {
      console.warn("Samsara HOS clocks fetch failed:", err);
      break;
    }
  }
  return out;
}

export async function syncSamsaraFleetData(
  currentVehicles: Vehicle[],
  currentDrivers: Driver[],
  after?: string,
): Promise<SamsaraFleetSyncResult> {
  const token = await getSavedSamsaraToken();
  if (!token) throw new Error("No Samsara token configured");

  const statTypes = DEFAULT_STAT_TYPES.join(",");
  const feedUrl = (cursor?: string) =>
    `/fleet/vehicles/stats/feed?types=${statTypes}${cursor ? `&after=${cursor}` : ""}`;

  const runFetch = (cursor?: string) =>
    Promise.all([
      samsaraFetch<SamsaraVehicleDirectoryResponse>("/fleet/vehicles", token),
      samsaraFetch<SamsaraVehicleStatsFeedResponse>(feedUrl(cursor), token),
      samsaraFetch<SamsaraDriversResponse>("/fleet/drivers", token),
    ]);

  let directory: SamsaraVehicleDirectoryResponse;
  let feed: SamsaraVehicleStatsFeedResponse;
  let driversRes: SamsaraDriversResponse;
  try {
    [directory, feed, driversRes] = await runFetch(after);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (after && /Parameters differ from previous paginated request/i.test(msg)) {
      // Samsara rejects stale cursors. Drop it and retry without.
      saveAppSetting("samsara_cursor", "");
      [directory, feed, driversRes] = await runFetch(undefined);
    } else {
      throw err;
    }
  }

  const mergedVehicles = await mergeSamsaraVehicles(currentVehicles, directory.data, feed);
  const mergedDrivers = mergeSamsaraDrivers(currentDrivers, driversRes.data);

  return {
    vehicles: mergedVehicles.vehicles,
    drivers: mergedDrivers.drivers,
    importedVehicleCount: mergedVehicles.importedCount,
    updatedVehicleCount: mergedVehicles.updatedCount,
    importedDriverCount: mergedDrivers.importedCount,
    updatedDriverCount: mergedDrivers.updatedCount,
    endCursor: feed.pagination?.endCursor,
  };
}

async function mergeSamsaraVehicles(
  vehicles: Vehicle[],
  directoryItems: SamsaraVehicleDirectoryItem[],
  feed: SamsaraVehicleStatsFeedResponse,
) {
  const now = new Date().toISOString();
  const nextVehicles = [...vehicles];
  let importedCount = 0;
  let updatedCount = 0;
  const decodedVinMap = await decodeDirectoryVins(directoryItems);

  for (const item of directoryItems) {
    const existingIndex = findVehicleIndex(nextVehicles, item.id, item.vin);
    const feedItem = feed.data.find((entry) => entry.id === item.id);
    const stats = extractStats(feedItem);
    const decodedVin = item.vin ? decodedVinMap.get(item.vin.toUpperCase()) : undefined;

    if (existingIndex === -1) {
      nextVehicles.push({
        id: generateId(),
        year: decodedVin?.year || new Date().getFullYear(),
        make: decodedVin?.make || "Samsara",
        model: decodedVin?.model || item.name || "Imported Vehicle",
        vin: item.vin || "",
        licensePlate: item.licensePlate || "",
        status: stats.engineState?.toLowerCase() === "off" ? "maintenance" : "active",
        maintenanceLog: [],
        notes: "Imported from Samsara.",
        externalSource: "samsara",
        externalId: item.id,
        lastSyncedAt: now,
        lastKnownLocation: stats.lastKnownLocation,
        lastKnownLocationAt: stats.lastKnownLocationAt,
        lastKnownLatitude: stats.lastKnownLatitude,
        lastKnownLongitude: stats.lastKnownLongitude,
        lastKnownSpeedMilesPerHour: stats.lastKnownSpeedMilesPerHour,
        engineState: stats.engineState,
        mileage: stats.mileage,
      });
      importedCount += 1;
      continue;
    }

    // Existing vehicle — only update GPS, mileage, engine state, and speed.
    // Never overwrite user-managed fields (year, make, model, plate, status, notes, etc.)
    const existing = nextVehicles[existingIndex];
    nextVehicles[existingIndex] = {
      ...existing,
      externalSource: "samsara",
      externalId: item.id,
      lastSyncedAt: now,
      // GPS + mileage only
      lastKnownLocation: stats.lastKnownLocation || existing.lastKnownLocation,
      lastKnownLocationAt: stats.lastKnownLocationAt || existing.lastKnownLocationAt,
      lastKnownLatitude: stats.lastKnownLatitude ?? existing.lastKnownLatitude,
      lastKnownLongitude: stats.lastKnownLongitude ?? existing.lastKnownLongitude,
      lastKnownSpeedMilesPerHour: stats.lastKnownSpeedMilesPerHour ?? existing.lastKnownSpeedMilesPerHour,
      engineState: stats.engineState || existing.engineState,
      mileage: stats.mileage ?? existing.mileage,
    };
    updatedCount += 1;
  }

  return { vehicles: nextVehicles, importedCount, updatedCount };
}

async function decodeDirectoryVins(directoryItems: SamsaraVehicleDirectoryItem[]) {
  const uniqueVins = [...new Set(directoryItems.map((item) => item.vin?.trim().toUpperCase()).filter(Boolean))] as string[];
  const decodedEntries = await Promise.all(uniqueVins.map(async (vin) => {
    try {
      const decoded = await decodeVin(vin);
      return [vin, decoded] as const;
    } catch {
      return [vin, null] as const;
    }
  }));

  return new Map(decodedEntries);
}

function mergeSamsaraDrivers(drivers: Driver[], samsaraDrivers: SamsaraDriverItem[]) {
  const now = new Date().toISOString();
  const nextDrivers = [...drivers];
  let importedCount = 0;
  let updatedCount = 0;

  for (const item of samsaraDrivers) {
    const existingIndex = nextDrivers.findIndex((driver) =>
      (driver.externalSource === "samsara" && driver.externalId === item.id)
      || driver.name.toLowerCase() === item.name.toLowerCase(),
    );

    const status = mapDriverStatus(item.driverActivationStatus);

    if (existingIndex === -1) {
      nextDrivers.push({
        id: generateId(),
        name: item.name,
        phone: "",
        email: "",
        licenseNumber: "",
        licenseExpiry: "",
        status,
        hireDate: item.createdAtTime?.split("T")[0] || "",
        totalMiles: 0,
        totalEarnings: 0,
        externalSource: "samsara",
        externalId: item.id,
        username: item.username,
        timezone: item.timezone,
        lastSyncedAt: now,
      });
      importedCount += 1;
      continue;
    }

    // Existing driver — only update Samsara link, not user-managed fields (name, status, pay, etc.)
    const existing = nextDrivers[existingIndex];
    nextDrivers[existingIndex] = {
      ...existing,
      externalSource: "samsara",
      externalId: item.id,
      username: item.username || existing.username,
      timezone: item.timezone || existing.timezone,
      lastSyncedAt: now,
    };
    updatedCount += 1;
  }

  return { drivers: nextDrivers, importedCount, updatedCount };
}

function findVehicleIndex(vehicles: Vehicle[], externalId: string, vin?: string) {
  return vehicles.findIndex((vehicle) =>
    (vehicle.externalSource === "samsara" && vehicle.externalId === externalId)
    || (vin ? vehicle.vin.toUpperCase() === vin.toUpperCase() : false),
  );
}

function extractStats(feedItem?: SamsaraVehicleFeedItem) {
  const gpsPoint = getLatestPoint(feedItem?.gps);
  const obdOdometer = getLatestPoint(feedItem?.obdOdometerMeters);
  const gpsOdometer = getLatestPoint(feedItem?.gpsOdometerMeters);
  const engineState = getLatestPoint(feedItem?.engineStates);
  const mileageMeters = obdOdometer?.value ?? gpsOdometer?.value;

  return {
    mileage: mileageMeters ? Math.round(mileageMeters / 1609.344) : undefined,
    engineState: engineState?.value,
    lastKnownLocation: gpsPoint?.reverseGeo?.formattedLocation,
    lastKnownLocationAt: gpsPoint?.time,
    lastKnownLatitude: gpsPoint?.latitude,
    lastKnownLongitude: gpsPoint?.longitude,
    lastKnownSpeedMilesPerHour: gpsPoint?.speedMilesPerHour,
  };
}

function mapDriverStatus(status?: SamsaraDriverItem["driverActivationStatus"]): DriverStatus {
  return status === "deactivated" ? "inactive" : "active";
}

function getLatestPoint<T extends { time: string }>(points?: T[]): T | undefined {
  if (!points?.length) return undefined;
  return [...points].sort((a, b) => a.time.localeCompare(b.time)).at(-1);
}

export const samsaraStatTypes: SamsaraStatType[] = [...DEFAULT_STAT_TYPES];

let samsaraAutoSyncInterval: ReturnType<typeof setInterval> | null = null;

async function runSamsaraAutoSyncTick() {
  const token = await getSavedSamsaraToken();
  if (!token) return;

  const vehicles = getVehicles();
  const drivers = getDrivers();
  const cursor = getAppSetting("samsara_cursor") || undefined;

  const synced = await syncSamsaraFleetData(vehicles, drivers, cursor);
  saveVehicles(synced.vehicles);
  saveDrivers(synced.drivers);

  if (synced.endCursor) {
    saveAppSetting("samsara_cursor", synced.endCursor);
  }
  saveAppSetting("samsara_last_sync_at", new Date().toISOString());
}

export function startSamsaraAutoSync(intervalMs = 15 * 60 * 1000): void {
  if (samsaraAutoSyncInterval) return;
  samsaraAutoSyncInterval = setInterval(() => {
    runSamsaraAutoSyncTick().catch((err) => {
      console.warn("Samsara auto-sync failed:", err);
    });
  }, intervalMs);
}

export function stopSamsaraAutoSync(): void {
  if (samsaraAutoSyncInterval) {
    clearInterval(samsaraAutoSyncInterval);
    samsaraAutoSyncInterval = null;
  }
}
