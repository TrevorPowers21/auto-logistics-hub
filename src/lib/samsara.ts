import { generateId } from "@/lib/store";
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

export interface SamsaraFleetSyncResult {
  vehicles: Vehicle[];
  drivers: Driver[];
  importedVehicleCount: number;
  updatedVehicleCount: number;
  importedDriverCount: number;
  updatedDriverCount: number;
  endCursor?: string;
}

interface LocalSamsaraSyncResponse {
  vehicleDirectory: SamsaraVehicleDirectoryResponse;
  vehicleFeed: SamsaraVehicleStatsFeedResponse;
  drivers: SamsaraDriverItem[];
}

export async function getSavedSamsaraToken() {
  const response = await fetch("/api/samsara/token");

  if (!response.ok) {
    throw new Error("Failed to read saved Samsara token");
  }

  const data = await response.json() as { token?: string };
  return data.token || "";
}

export async function saveSamsaraToken(token: string) {
  const response = await fetch("/api/samsara/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Failed to save Samsara token" }));
    throw new Error(data.error || "Failed to save Samsara token");
  }
}

export function isSamsaraConfigured(token?: string | null) {
  return Boolean(token);
}

export async function syncSamsaraFleetData(
  currentVehicles: Vehicle[],
  currentDrivers: Driver[],
  after?: string,
): Promise<SamsaraFleetSyncResult> {
  const response = await fetch("/api/samsara/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cursor: after || undefined }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Failed to sync Samsara data");
  }

  const data = payload as LocalSamsaraSyncResponse;
  const mergedVehicles = await mergeSamsaraVehicles(currentVehicles, data.vehicleDirectory.data, data.vehicleFeed);
  const mergedDrivers = mergeSamsaraDrivers(currentDrivers, data.drivers);

  return {
    vehicles: mergedVehicles.vehicles,
    drivers: mergedDrivers.drivers,
    importedVehicleCount: mergedVehicles.importedCount,
    updatedVehicleCount: mergedVehicles.updatedCount,
    importedDriverCount: mergedDrivers.importedCount,
    updatedDriverCount: mergedDrivers.updatedCount,
    endCursor: data.vehicleFeed.pagination?.endCursor,
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
