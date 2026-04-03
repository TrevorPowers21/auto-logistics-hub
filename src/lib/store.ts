import { supabase } from "./supabase";
import {
  Address, Car, DispatchCodeDefinition, Driver, DriverBoardEntry, DriverBoardStop,
  DriverDailyUpdate, FuelEntry, Load, Expense, Invoice, LocationProfile,
  PlanningSlot, Vehicle, FleetMaintenanceEntry,
} from "./types";

// ─── Key / Table mapping ──────────────────────────────────────────────────────

type StoreKey =
  | "cars" | "drivers" | "driverUpdates" | "driverBoards" | "dispatchCodes"
  | "locations" | "addresses" | "loads" | "expenses" | "invoices" | "vehicles"
  | "fuelEntries" | "planningSlots";

const TABLE_MAP: Record<StoreKey, string> = {
  cars: "cars",
  drivers: "drivers",
  driverUpdates: "driver_daily_updates",
  driverBoards: "driver_boards",
  dispatchCodes: "dispatch_codes",
  locations: "locations",
  addresses: "addresses",
  loads: "loads",
  expenses: "expenses",
  invoices: "invoices",
  vehicles: "vehicles",
  fuelEntries: "fuel_entries",
  planningSlots: "planning_slots",
};

// ─── Case conversion ──────────────────────────────────────────────────────────

function toSnake(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function objToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[toSnake(k)] = v;
  }
  return out;
}

function objToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[toCamel(k)] = v;
  }
  return out;
}

// Special column renames that don't follow simple camelCase↔snake_case
const COLUMN_OVERRIDES: Record<string, Record<string, string>> = {
  vehicles: {
    lastKnownSpeedMilesPerHour: "last_known_speed_mph",
  },
};

const REVERSE_OVERRIDES: Record<string, Record<string, string>> = {
  vehicles: {
    last_known_speed_mph: "lastKnownSpeedMilesPerHour",
  },
};

function rowToSnake(table: string, obj: Record<string, unknown>): Record<string, unknown> {
  const overrides = COLUMN_OVERRIDES[table] || {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const col = overrides[k] || toSnake(k);
    out[col] = v;
  }
  return out;
}

function rowToCamel(table: string, obj: Record<string, unknown>): Record<string, unknown> {
  const overrides = REVERSE_OVERRIDES[table] || {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const prop = overrides[k] || toCamel(k);
    out[prop] = v;
  }
  return out;
}

// ─── localStorage layer (fast reads) ──────────────────────────────────────────

const DEFAULTS: Record<StoreKey, unknown[]> = {
  cars: [],
  drivers: [],
  driverUpdates: [],
  driverBoards: [],
  dispatchCodes: [],
  locations: [],
  addresses: [],
  loads: [],
  expenses: [],
  invoices: [],
  vehicles: [],
  fuelEntries: [],
  planningSlots: [],
};

function getLocal<T>(key: StoreKey): T[] {
  try {
    const raw = localStorage.getItem(`transport_${key}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULTS[key] as T[];
}

function setLocal<T>(key: StoreKey, data: T[]) {
  localStorage.setItem(`transport_${key}`, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("store-update", { detail: key }));
}

// ─── Supabase sync (background writes + hydration) ───────────────────────────

// Track hydration status
const hydrated = new Set<string>();
const hydrating = new Map<string, Promise<void>>();

async function hydrateKey(key: StoreKey): Promise<void> {
  if (!supabase || hydrated.has(key)) return;
  if (hydrating.has(key)) return hydrating.get(key);

  const table = TABLE_MAP[key];
  const promise = (async () => {
    try {
      const { data, error } = await supabase.from(table).select("*");
      if (error) { console.warn(`Supabase hydrate ${table}: ${error.message} (table may not exist yet)`); hydrated.add(key); return; }
      if (!data || data.length === 0) { hydrated.add(key); return; }

      let camelData = data.map((row) => rowToCamel(table, row as Record<string, unknown>));

      // Reconstitute nested data for vehicles and driver boards
      if (key === "vehicles") {
        const { data: maint } = await supabase.from("vehicle_maintenance_log").select("*");
        const maintByVehicle = new Map<string, FleetMaintenanceEntry[]>();
        for (const row of (maint || [])) {
          const camel = objToCamel(row as Record<string, unknown>) as unknown as FleetMaintenanceEntry & { vehicleId: string };
          const vid = camel.vehicleId;
          if (!maintByVehicle.has(vid)) maintByVehicle.set(vid, []);
          maintByVehicle.get(vid)!.push({ id: camel.id, date: camel.date, type: camel.type, mileage: camel.mileage, details: camel.details });
        }
        camelData = camelData.map((v: any) => ({ ...v, maintenanceLog: maintByVehicle.get(v.id) || [] }));
      }

      if (key === "driverBoards") {
        const { data: stops } = await supabase.from("driver_board_stops").select("*");
        const stopsByBoard = new Map<string, DriverBoardStop[]>();
        for (const row of (stops || [])) {
          const camel = objToCamel(row as Record<string, unknown>) as unknown as DriverBoardStop & { boardId: string };
          const bid = camel.boardId;
          if (!stopsByBoard.has(bid)) stopsByBoard.set(bid, []);
          const { boardId: _, ...stop } = camel as any;
          stopsByBoard.get(bid)!.push(stop);
        }
        camelData = camelData.map((b: any) => ({ ...b, stops: stopsByBoard.get(b.id) || [] }));
      }

      if (key === "loads") {
        // Reconstitute carIds from cars table
        const { data: cars } = await supabase.from("cars").select("id, load_id");
        const carsByLoad = new Map<string, string[]>();
        for (const row of (cars || [])) {
          const lid = (row as any).load_id;
          if (!lid) continue;
          if (!carsByLoad.has(lid)) carsByLoad.set(lid, []);
          carsByLoad.get(lid)!.push((row as any).id);
        }
        camelData = camelData.map((l: any) => ({ ...l, carIds: carsByLoad.get(l.id) || undefined }));
      }

      setLocal(key, camelData as any[]);
      hydrated.add(key);
    } catch (err) {
      console.warn(`Supabase hydrate ${table} failed:`, err);
      hydrated.add(key); // Don't retry on failure
    }
  })();

  hydrating.set(key, promise);
  await promise;
  hydrating.delete(key);
}

// Background sync: write entire collection to Supabase
async function syncToSupabase<T extends { id: string }>(key: StoreKey, data: T[]): Promise<void> {
  if (!supabase) return;
  const table = TABLE_MAP[key];

  try {
    // Strip nested arrays before upserting
    const rows = data.map((item) => {
      const plain = { ...item } as Record<string, unknown>;
      // Remove fields that live in child tables
      if (key === "vehicles") delete plain.maintenanceLog;
      if (key === "driverBoards") delete plain.stops;
      if (key === "loads") delete plain.carIds;
      return rowToSnake(table, plain);
    });

    // Upsert all rows
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (error) console.error(`Supabase upsert ${table}:`, error);

    // Handle deleted rows: fetch current IDs from Supabase, delete any not in data
    const { data: existing } = await supabase.from(table).select("id");
    if (existing) {
      const currentIds = new Set(data.map((d) => d.id));
      const toDelete = existing.filter((r: any) => !currentIds.has(r.id)).map((r: any) => r.id);
      if (toDelete.length > 0) {
        await supabase.from(table).delete().in("id", toDelete);
      }
    }

    // Sync child tables
    if (key === "vehicles") {
      const allMaint: Record<string, unknown>[] = [];
      for (const v of data as unknown as Vehicle[]) {
        for (const m of v.maintenanceLog || []) {
          allMaint.push(objToSnake({ ...m, vehicleId: v.id }));
        }
      }
      // Replace all maintenance rows
      await supabase.from("vehicle_maintenance_log").delete().neq("id", "");
      if (allMaint.length > 0) {
        await supabase.from("vehicle_maintenance_log").upsert(allMaint, { onConflict: "id" });
      }
    }

    if (key === "driverBoards") {
      const allStops: Record<string, unknown>[] = [];
      for (const b of data as unknown as DriverBoardEntry[]) {
        for (const s of b.stops || []) {
          allStops.push(objToSnake({ ...s, boardId: b.id }));
        }
      }
      await supabase.from("driver_board_stops").delete().neq("id", "");
      if (allStops.length > 0) {
        await supabase.from("driver_board_stops").upsert(allStops, { onConflict: "id" });
      }
    }
  } catch (err) {
    console.warn(`Supabase sync ${table} failed:`, err);
  }
}

// ─── Public API (unchanged signatures) ────────────────────────────────────────

function getStore<T>(key: StoreKey): T[] {
  // Trigger background hydration if not done yet
  if (!hydrated.has(key)) hydrateKey(key);
  return getLocal<T>(key);
}

function setStore<T extends { id: string }>(key: StoreKey, data: T[]) {
  setLocal(key, data);
  // Fire-and-forget sync to Supabase
  syncToSupabase(key, data);
}

export function getDrivers(): Driver[] { return getStore<Driver>("drivers"); }
export function getCars(): Car[] { return getStore<Car>("cars"); }
export function getDriverUpdates(): DriverDailyUpdate[] { return getStore<DriverDailyUpdate>("driverUpdates"); }
export function getDriverBoards(): DriverBoardEntry[] { return getStore<DriverBoardEntry>("driverBoards"); }
export function getDispatchCodes(): DispatchCodeDefinition[] { return getStore<DispatchCodeDefinition>("dispatchCodes"); }
export function getLocations(): LocationProfile[] { return getStore<LocationProfile>("locations"); }
export function getAddresses(): Address[] { return getStore<Address>("addresses"); }
export function getLoads(): Load[] { return getStore<Load>("loads"); }
export function getExpenses(): Expense[] { return getStore<Expense>("expenses"); }
export function getInvoices(): Invoice[] { return getStore<Invoice>("invoices"); }
export function getVehicles(): Vehicle[] { return getStore<Vehicle>("vehicles"); }
export function getFuelEntries(): FuelEntry[] { return getStore<FuelEntry>("fuelEntries"); }
export function getPlanningSlots(): PlanningSlot[] { return getStore<PlanningSlot>("planningSlots"); }

export function saveDrivers(d: Driver[]) { setStore("drivers", d); }
export function saveCars(d: Car[]) { setStore("cars", d); }
export function saveDriverUpdates(d: DriverDailyUpdate[]) { setStore("driverUpdates", d); }
export function saveDriverBoards(d: DriverBoardEntry[]) { setStore("driverBoards", d); }
export function saveDispatchCodes(d: DispatchCodeDefinition[]) { setStore("dispatchCodes", d); }
export function saveLocations(d: LocationProfile[]) { setStore("locations", d); }
export function saveAddresses(d: Address[]) { setStore("addresses", d); }
export function saveLoads(d: Load[]) { setStore("loads", d); }
export function saveExpenses(d: Expense[]) { setStore("expenses", d); }
export function saveInvoices(d: Invoice[]) { setStore("invoices", d); }
export function saveVehicles(d: Vehicle[]) { setStore("vehicles", d); }
export function saveFuelEntries(d: FuelEntry[]) { setStore("fuelEntries", d); }
export function savePlanningSlots(d: PlanningSlot[]) { setStore("planningSlots", d); }

// ─── App Settings ─────────────────────────────────────────────────────────────

export function getAppSetting(key: string): string | null {
  try {
    return localStorage.getItem(`transport_setting_${key}`);
  } catch {
    return null;
  }
}

export function saveAppSetting(key: string, value: string) {
  localStorage.setItem(`transport_setting_${key}`, value);
  window.dispatchEvent(new CustomEvent("store-update", { detail: `setting:${key}` }));
  // Sync to Supabase
  if (supabase) {
    supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" }).then();
  }
}

// ─── ID Generation ────────────────────────────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).substring(2, 14);
}

// ─── Hydrate all on startup ───────────────────────────────────────────────────

export async function hydrateAll(): Promise<void> {
  if (!supabase) return;
  const keys = Object.keys(TABLE_MAP) as StoreKey[];
  await Promise.all([
    ...keys.map((k) => hydrateKey(k)),
    hydrateAppSettings(),
  ]);
}

async function hydrateAppSettings(): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from("app_settings").select("*");
    if (error || !data) return;
    for (const row of data as Array<{ key: string; value: string }>) {
      localStorage.setItem(`transport_setting_${row.key}`, row.value);
    }
    window.dispatchEvent(new CustomEvent("store-update", { detail: "settings" }));
  } catch { /* ignore — table may not exist */ }
}

// ─── Auto-sync (poll Supabase for cross-device updates) ─────────────────────

let syncInterval: ReturnType<typeof setInterval> | null = null;

/** Force re-hydration of all keys from Supabase */
export async function refreshFromSupabase(): Promise<void> {
  if (!supabase) return;
  // Clear hydration flags so hydrateKey actually fetches
  hydrated.clear();
  hydrating.clear();
  await hydrateAll();
  saveAppSetting("last_auto_sync", new Date().toISOString());
}

/** Start polling Supabase every `intervalMs` (default 30s) for fresh data */
export function startAutoSync(intervalMs = 30_000): void {
  if (syncInterval) return; // already running
  syncInterval = setInterval(() => {
    refreshFromSupabase().catch((err) => console.warn("Auto-sync failed:", err));
  }, intervalMs);
}

/** Stop the auto-sync polling */
export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
