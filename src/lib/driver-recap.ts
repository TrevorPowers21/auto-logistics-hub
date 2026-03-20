import {
  DispatchCodeDefinition,
  DispatchStopStatus,
  Driver,
  DriverBoardEntry,
  DriverBoardStop,
  DriverDailyStatus,
  DriverDailyUpdate,
  Expense,
  Load,
  Vehicle,
} from "./types";

export interface DriverRecapRow {
  driverId: string;
  driverName: string;
  vehicleLabel: string;
  status: DriverDailyStatus;
  location: string;
  pickups: number;
  deliveries: number;
  activeLoads: number;
  milesDriven: number;
  revenue: number;
  expenses: number;
  net: number;
  notes: string;
  nextAction: string;
}

export interface BoardTotals {
  totalCars: number;
  completedCars: number;
  heldCars: number;
}

const activeLoadStatuses = new Set(["booked", "dispatched", "in_transit"]);

export function formatDateInput(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(date);
}

export function getYesterdayDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatDateInput(date);
}

export function formatRecapHeading(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function deriveStatus(update: DriverDailyUpdate | undefined, activeLoads: number, deliveries: number): DriverDailyStatus {
  if (update) return update.status;
  if (deliveries > 0) return "delivered";
  if (activeLoads > 0) return "en_route";
  return "available";
}

export function buildDriverRecapRows(
  date: string,
  drivers: Driver[],
  loads: Load[],
  expenses: Expense[],
  updates: DriverDailyUpdate[],
  vehicles: Vehicle[],
): DriverRecapRow[] {
  return drivers
    .filter((driver) => driver.status !== "inactive")
    .map((driver) => {
      const vehicle = vehicles.find((item) => item.id === driver.assignedVehicleId);
      const driverLoads = loads.filter((load) => load.driverId === driver.id);
      const pickups = driverLoads.filter((load) => load.pickupDate === date).length;
      const deliveredLoads = driverLoads.filter((load) => load.deliveryDate === date && load.status === "delivered");
      const deliveries = deliveredLoads.length;
      const activeLoads = driverLoads.filter((load) => activeLoadStatuses.has(load.status)).length;
      const driverExpenses = expenses.filter((expense) => expense.driverId === driver.id && expense.date === date);
      const dayUpdates = updates
        .filter((update) => update.driverId === driver.id && update.date === date)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latestUpdate = dayUpdates[0];
      const milesDriven = dayUpdates.reduce((sum, update) => sum + update.milesDriven, 0);
      const revenue = deliveredLoads.reduce((sum, load) => sum + load.price, 0);
      const totalExpenses = driverExpenses.reduce((sum, expense) => sum + expense.amount, 0);

      return {
        driverId: driver.id,
        driverName: driver.name,
        vehicleLabel: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Unassigned",
        status: deriveStatus(latestUpdate, activeLoads, deliveries),
        location: latestUpdate?.location || "No update logged",
        pickups,
        deliveries,
        activeLoads,
        milesDriven,
        revenue,
        expenses: totalExpenses,
        net: revenue - totalExpenses,
        notes: latestUpdate?.notes || "",
        nextAction: latestUpdate?.nextAction || (activeLoads > 0 ? "Monitor active load progress." : "No action scheduled."),
      };
    })
    .sort((a, b) => {
      if (b.deliveries !== a.deliveries) return b.deliveries - a.deliveries;
      if (b.activeLoads !== a.activeLoads) return b.activeLoads - a.activeLoads;
      return a.driverName.localeCompare(b.driverName);
    });
}

export function getCodeMeaning(token: string | undefined, definitions: DispatchCodeDefinition[]): string | undefined {
  if (!token) return undefined;
  return definitions.find((definition) => definition.token.toUpperCase() === token.toUpperCase())?.meaning;
}

export function normalizeToken(value: string): string {
  return value.trim().toUpperCase();
}

export function createEmptyStop(): DriverBoardStop {
  return {
    id: Math.random().toString(36).substring(2, 10),
    carCount: 0,
    pickupLocation: "",
    dropoffLocation: "",
    status: "completed",
    overnightLocation: "",
    notes: "",
  };
}

export function normalizeBoardStops(entry: DriverBoardEntry | undefined): DriverBoardStop[] {
  if (!entry) return [];
  if (entry.stops?.length) return entry.stops;

  return (entry.items || [])
    .map((item, index) => {
      const cleaned = item.trim();
      const match = cleaned.match(/^([A-Za-z0-9]+)\s*-\s*(.+)$/);
      const count = Number(match?.[1]);
      const pickupToken = match?.[2]?.trim();

      return {
        id: `${entry.id}-${index}`,
        carCount: Number.isFinite(count) ? count : 0,
        pickupLocation: pickupToken ? normalizeToken(pickupToken) : cleaned,
        dropoffLocation: "",
        status: "completed" as DispatchStopStatus,
        notes: cleaned,
      };
    })
    .filter((stop) => stop.carCount > 0 || stop.pickupLocation || stop.notes);
}

export function sanitizeBoardStops(stops: DriverBoardStop[]): DriverBoardStop[] {
  return stops
    .map((stop) => ({
      ...stop,
      pickupLocation: normalizeToken(stop.pickupLocation),
      dropoffLocation: normalizeToken(stop.dropoffLocation),
      overnightLocation: normalizeToken(stop.overnightLocation || ""),
      notes: stop.notes?.trim() || "",
    }))
    .filter((stop) =>
      stop.carCount > 0 ||
      stop.pickupLocation ||
      stop.dropoffLocation ||
      stop.overnightLocation ||
      stop.notes,
    );
}

export function getBoardTotals(stops: DriverBoardStop[]): BoardTotals {
  return stops.reduce<BoardTotals>((totals, stop) => {
    totals.totalCars += stop.carCount;
    if (stop.status === "completed") {
      totals.completedCars += stop.carCount;
    } else {
      totals.heldCars += stop.carCount;
    }
    return totals;
  }, { totalCars: 0, completedCars: 0, heldCars: 0 });
}

export function formatStopSummary(stop: DriverBoardStop, definitions: DispatchCodeDefinition[]): string {
  const pickupMeaning = getCodeMeaning(normalizeToken(stop.pickupLocation), definitions);
  const dropoffMeaning = getCodeMeaning(normalizeToken(stop.dropoffLocation), definitions);
  const overnightMeaning = getCodeMeaning(normalizeToken(stop.overnightLocation), definitions);
  const route = [
    `${stop.carCount} car${stop.carCount === 1 ? "" : "s"}`,
    `PU ${pickupMeaning || stop.pickupLocation}`,
    `DO ${dropoffMeaning || stop.dropoffLocation}`,
  ];

  if (stop.status === "held_overnight") {
    route.push(`Held at ${overnightMeaning || stop.overnightLocation || "shop"}`);
  } else {
    route.push("Completed");
  }

  if (stop.notes) {
    route.push(stop.notes);
  }

  return route.join(" | ");
}

export function getBoardTokens(entries: DriverBoardEntry[]): string[] {
  return Array.from(new Set(
    entries
      .flatMap((entry) => normalizeBoardStops(entry))
      .flatMap((stop) => [stop.pickupLocation, stop.dropoffLocation, stop.overnightLocation]
        .filter((token): token is string => Boolean(token))
        .map((token) => normalizeToken(token))),
  )).sort((a, b) => a.localeCompare(b));
}

export function getUnresolvedBoardTokens(entries: DriverBoardEntry[], definitions: DispatchCodeDefinition[]): string[] {
  return getBoardTokens(entries).filter((token) => !getCodeMeaning(token, definitions));
}

export function buildBoardExportText(
  date: string,
  drivers: Driver[],
  rows: DriverRecapRow[],
  boardEntries: DriverBoardEntry[],
  definitions: DispatchCodeDefinition[],
): string {
  const rowByDriver = new Map(rows.map((row) => [row.driverId, row]));
  const boardByDriver = new Map(boardEntries.map((entry) => [entry.driverId, entry]));
  const activeDrivers = drivers.filter((driver) => driver.status !== "inactive");
  const deliveredLoads = rows.reduce((sum, row) => sum + row.deliveries, 0);
  const miles = rows.reduce((sum, row) => sum + row.milesDriven, 0);
  const net = rows.reduce((sum, row) => sum + row.net, 0);

  const header = [
    `Driver recap for ${formatRecapHeading(date)}`,
    `Active drivers: ${activeDrivers.filter((driver) => rowByDriver.get(driver.id)?.status !== "off_duty").length}`,
    `Delivered loads: ${deliveredLoads}`,
    `Miles logged: ${miles.toLocaleString()}`,
    `Net revenue: $${net.toLocaleString()}`,
    "",
  ];

  const lines = activeDrivers.map((driver) => {
    const row = rowByDriver.get(driver.id);
    const stops = normalizeBoardStops(boardByDriver.get(driver.id));
    const boardSummary = stops.slice(0, 4).map((stop) => formatStopSummary(stop, definitions)).join(" || ");
    const totals = getBoardTotals(stops);

    return [
      `${driver.name} - ${row?.status.replace("_", " ") || "available"}`,
      `Location: ${row?.location || "No update logged"}`,
      `Board: ${boardSummary || "No board items logged"}`,
      `Cars: ${totals.totalCars} total, ${totals.completedCars} completed, ${totals.heldCars} held`,
      `Loads: ${row?.deliveries || 0} delivered, ${row?.activeLoads || 0} active`,
      `Miles: ${(row?.milesDriven || 0).toLocaleString()}`,
      `Next: ${row?.nextAction || "No next action logged"}`,
    ].join(" | ");
  });

  return [...header, ...lines].join("\n");
}
