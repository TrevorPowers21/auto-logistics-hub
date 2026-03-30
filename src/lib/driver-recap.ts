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
  overnightCars: number;  // same driver, held at yard between legs
  splitCars: number;      // different drivers handle pickup/delivery
  heldCars: number;       // overnight + split combined (convenience)
  totalPay: number | null; // null when no pay rates are set
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
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatRecapHeadingShort(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
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

/** Pay for a single stop. Returns null if no rate is configured. */
export function getStopPay(stop: DriverBoardStop, driverDefaultRate?: number): number | null {
  const rate = stop.payRatePerCar ?? driverDefaultRate;
  if (rate === undefined || rate === null) return null;
  return stop.carCount * rate;
}

/** Total pay for all stops. Returns null if no rates are configured at all. */
export function getBoardPayTotal(stops: DriverBoardStop[], driverDefaultRate?: number): number | null {
  let total = 0;
  let hasAnyRate = false;
  for (const stop of stops) {
    const pay = getStopPay(stop, driverDefaultRate);
    if (pay !== null) {
      total += pay;
      hasAnyRate = true;
    }
  }
  return hasAnyRate ? total : null;
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

export function getBoardTotals(stops: DriverBoardStop[], driverDefaultRate?: number): BoardTotals {
  const base = stops.reduce<Omit<BoardTotals, "totalPay">>(
    (totals, stop) => {
      totals.totalCars += stop.carCount;
      if (stop.status === "completed") {
        totals.completedCars += stop.carCount;
      } else if (stop.status === "split") {
        totals.splitCars += stop.carCount;
        totals.heldCars += stop.carCount;
      } else {
        // overnight (or legacy held_overnight)
        totals.overnightCars += stop.carCount;
        totals.heldCars += stop.carCount;
      }
      return totals;
    },
    { totalCars: 0, completedCars: 0, overnightCars: 0, splitCars: 0, heldCars: 0 },
  );

  return { ...base, totalPay: getBoardPayTotal(stops, driverDefaultRate) };
}

export function formatStopSummary(stop: DriverBoardStop, definitions: DispatchCodeDefinition[]): string {
  const pickupMeaning = getCodeMeaning(normalizeToken(stop.pickupLocation), definitions);
  const dropoffMeaning = getCodeMeaning(normalizeToken(stop.dropoffLocation), definitions);
  const overnightMeaning = getCodeMeaning(normalizeToken(stop.overnightLocation ?? ""), definitions);
  const route = [
    `${stop.carCount} car${stop.carCount === 1 ? "" : "s"}`,
    `PU: ${pickupMeaning || stop.pickupLocation}`,
    `DO: ${dropoffMeaning || stop.dropoffLocation}`,
  ];

  if (stop.status === "overnight") {
    route.push(`Overnight at ${overnightMeaning || stop.overnightLocation || "shop"}`);
  } else if (stop.status === "split") {
    route.push(`Split — ${stop.splitLeg === "delivery" ? "delivery leg" : "pickup leg"}`);
  } else {
    route.push("Completed");
  }

  if (stop.notes) route.push(stop.notes);

  return route.join("  |  ");
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

/** Build a formatted daily recap export string. */
export function buildDailyExportText(
  date: string,
  driverRows: Array<{
    driver: Driver;
    stops: DriverBoardStop[];
    totalCars: number;
    completedCars: number;
    heldCars: number;
    totalPay: number | null;
  }>,
  pickupRecap: Array<{ location: string; cars: number }>,
  dropoffRecap: Array<{ location: string; cars: number }>,
): string {
  const divider = "─".repeat(60);
  const heading = formatRecapHeading(date);

  const totalCars = driverRows.reduce((s, r) => s + r.totalCars, 0);
  const completedCars = driverRows.reduce((s, r) => s + r.completedCars, 0);
  const heldCars = driverRows.reduce((s, r) => s + r.heldCars, 0);
  const totalPayRows = driverRows.filter((r) => r.totalPay !== null);
  const totalPay = totalPayRows.length > 0
    ? totalPayRows.reduce((s, r) => s + (r.totalPay ?? 0), 0)
    : null;

  const lines: string[] = [
    "MONROE AUTO TRANSPORT",
    `DRIVER RECAP  —  ${heading}`,
    divider,
    "",
    "DAILY TOTALS",
    `  Cars Moved:   ${totalCars}   |   Completed: ${completedCars}   |   Split: ${heldCars}`,
    totalPay !== null ? `  Total Pay:    $${totalPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "",
    "",
  ];

  // Pickup/dropoff recap side by side
  const maxLeft = Math.max(...pickupRecap.map((r) => r.location.length), 8);
  lines.push("PICKUP LOCATIONS" + " ".repeat(maxLeft - 8 + 6) + "DROP-OFF LOCATIONS");
  const maxRows = Math.max(pickupRecap.length, dropoffRecap.length);
  for (let i = 0; i < maxRows; i++) {
    const pu = pickupRecap[i];
    const do_ = dropoffRecap[i];
    const left = pu ? `  ${pu.location.padEnd(maxLeft + 2)} ${String(pu.cars).padStart(2)} car${pu.cars === 1 ? " " : "s"}` : "";
    const right = do_ ? `    ${do_.location.padEnd(maxLeft + 2)} ${String(do_.cars).padStart(2)} car${do_.cars === 1 ? "" : "s"}` : "";
    lines.push(left + right);
  }

  lines.push("");
  lines.push(divider);
  lines.push("");

  // Per-driver detail
  for (const row of driverRows) {
    if (row.stops.length === 0) continue;

    const payStr = row.totalPay !== null
      ? `  $${row.totalPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : "";
    lines.push(`${row.driver.name.toUpperCase()}  —  ${row.totalCars} cars${payStr}`);
    lines.push("  " + "─".repeat(56));

    for (const stop of row.stops) {
      const endLoc = stop.status === "overnight" ? (stop.overnightLocation || stop.dropoffLocation) : stop.dropoffLocation;
      const route = `${stop.pickupLocation} → ${endLoc}`;
      const statusStr = stop.status === "completed" ? "Completed" : stop.status === "overnight" ? "Overnight" : "Split    ";
      const rateStr = stop.payRatePerCar !== undefined
        ? `$${stop.payRatePerCar}/car`
        : (row.driver.payRatePerCar !== undefined ? `$${row.driver.payRatePerCar}/car` : "");
      const stopPay = getStopPay(stop, row.driver.payRatePerCar);
      const stopPayStr = stopPay !== null
        ? `  $${stopPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
        : "";
      const notesStr = stop.notes ? `  (${stop.notes})` : "";

      lines.push(
        `  ${String(stop.carCount).padStart(2)} cars  ${route.padEnd(30)}  ${statusStr}  ${rateStr}${stopPayStr}${notesStr}`,
      );
    }

    lines.push("");
  }

  lines.push(divider);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("Monroe Auto Transport Fleet Manager");

  return lines.filter((l) => l !== undefined).join("\n");
}

/** Build a formatted weekly recap export string. */
export function buildWeeklyExportText(
  weekStart: string,
  weekEnd: string,
  weekDates: string[],
  drivers: Driver[],
  boards: DriverBoardEntry[],
): string {
  const divider = "─".repeat(80);
  const startLabel = new Date(`${weekStart}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = new Date(`${weekEnd}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dayNames = weekDates.map((d) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
  );

  const activeDrivers = drivers.filter((d) => d.status !== "inactive");

  // Build per-driver per-day stats
  const driverStats = activeDrivers.map((driver) => {
    const dayCars = weekDates.map((date) => {
      const board = boards.find((b) => b.driverId === driver.id && b.date === date);
      const stops = normalizeBoardStops(board);
      return stops.reduce((s, stop) => s + stop.carCount, 0);
    });
    const dayPay = weekDates.map((date) => {
      const board = boards.find((b) => b.driverId === driver.id && b.date === date);
      const stops = normalizeBoardStops(board);
      return getBoardPayTotal(stops, driver.payRatePerCar);
    });
    const totalCars = dayCars.reduce((s, c) => s + c, 0);
    const totalPayVals = dayPay.filter((p) => p !== null) as number[];
    const totalPay = totalPayVals.length > 0 ? totalPayVals.reduce((s, p) => s + p, 0) : null;

    return { driver, dayCars, dayPay, totalCars, totalPay };
  }).filter((r) => r.totalCars > 0);

  const lines: string[] = [
    "MONROE AUTO TRANSPORT",
    `WEEKLY RECAP  —  ${startLabel} – ${endLabel}`,
    divider,
    "",
  ];

  // Header row
  const nameWidth = 22;
  const dayWidth = 6;
  const header = "DRIVER".padEnd(nameWidth) +
    dayNames.map((d) => d.padStart(dayWidth)).join("") +
    "  TOTAL".padStart(8) +
    "  PAY".padStart(14);
  lines.push(header);
  lines.push("─".repeat(header.length));

  for (const row of driverStats) {
    const name = row.driver.name.slice(0, nameWidth - 1).padEnd(nameWidth);
    const days = row.dayCars.map((c) => String(c || "—").padStart(dayWidth)).join("");
    const total = String(row.totalCars).padStart(8);
    const payStr = row.totalPay !== null
      ? `$${row.totalPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}`.padStart(14)
      : "—".padStart(14);
    lines.push(name + days + total + payStr);
  }

  // Fleet totals row
  const fleetCars = weekDates.map((_, i) => driverStats.reduce((s, r) => s + r.dayCars[i], 0));
  const fleetTotal = fleetCars.reduce((s, c) => s + c, 0);
  const fleetPayRows = driverStats.filter((r) => r.totalPay !== null);
  const fleetPay = fleetPayRows.length > 0
    ? fleetPayRows.reduce((s, r) => s + (r.totalPay ?? 0), 0)
    : null;

  lines.push("─".repeat(header.length));
  lines.push(
    "FLEET TOTAL".padEnd(nameWidth) +
    fleetCars.map((c) => String(c || "—").padStart(dayWidth)).join("") +
    String(fleetTotal).padStart(8) +
    (fleetPay !== null
      ? `$${fleetPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}`.padStart(14)
      : "—".padStart(14)),
  );

  lines.push("");
  lines.push(divider);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("Monroe Auto Transport Fleet Manager");

  return lines.join("\n");
}
