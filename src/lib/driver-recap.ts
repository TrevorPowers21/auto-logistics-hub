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

/**
 * Build the canonical stops list for a driver on a date.
 * Derives base stops from planning slots (only those with a loadId — i.e. real loads),
 * layers board entry overrides for status, and appends any manually-added board stops.
 * Use this anywhere you need driver activity totals, including analytics.
 */
export function buildDriverStopsForDate(
  driverId: string,
  date: string,
  planningSlots: Array<{ id: string; driverId?: string; date: string; loadId?: string; loadSummary?: string; pickupLocation?: string; deliveryLocation?: string; carCount?: number; customer?: string; notes?: string }>,
  loads: Array<{ id: string; pickupLocation?: string; deliveryLocation?: string; carIds?: string[]; customer?: string }>,
  boards: DriverBoardEntry[],
): DriverBoardStop[] {
  const driverPlanSlots = planningSlots.filter((s) =>
    s.driverId === driverId &&
    s.date === date &&
    s.loadSummary !== "OFF" &&
    s.loadId,
  );

  const baseStops: DriverBoardStop[] = driverPlanSlots.map((slot) => {
    const linkedLoad = slot.loadId ? loads.find((l) => l.id === slot.loadId) : undefined;
    return {
      id: `plan-${slot.id}`,
      carCount: slot.carCount || linkedLoad?.carIds?.length || 0,
      pickupLocation: slot.pickupLocation || linkedLoad?.pickupLocation || "",
      dropoffLocation: slot.deliveryLocation || linkedLoad?.deliveryLocation || "",
      customer: slot.customer || linkedLoad?.customer,
      status: "completed",
      notes: slot.notes || "",
    };
  });

  const board = boards.find((e) => e.driverId === driverId && e.date === date);
  const boardStops = normalizeBoardStops(board);

  // Layer board overrides on top
  const stopsWithOverrides = baseStops.map((stop) => {
    const override = boardStops.find((b) => b.id === stop.id);
    if (!override) return stop;
    return {
      ...stop,
      status: override.status,
      payRatePerCar: override.payRatePerCar,
      notes: override.notes || stop.notes,
    };
  });

  // Plus any manually-added board stops (no plan/carry prefix)
  const manualStops = boardStops.filter((b) =>
    !b.id?.startsWith("plan-") &&
    !b.id?.startsWith("carry-"),
  );

  return [...stopsWithOverrides, ...manualStops];
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
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function statusBadge(status: string): string {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    completed: { bg: "#d1fae5", fg: "#065f46", label: "Completed" },
    overnight: { bg: "#fef3c7", fg: "#92400e", label: "Overnight" },
    split: { bg: "#ede9fe", fg: "#5b21b6", label: "Split" },
  };
  const s = map[status] || map.completed;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${s.bg};color:${s.fg};">${s.label}</span>`;
}

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
  customerLookup?: (code: string) => string,
): string {
  const heading = formatRecapHeading(date);
  const totalCars = driverRows.reduce((s, r) => s + r.totalCars, 0);
  const completedCars = driverRows.reduce((s, r) => s + r.completedCars, 0);
  const heldCars = driverRows.reduce((s, r) => s + r.heldCars, 0);
  const totalPayRows = driverRows.filter((r) => r.totalPay !== null);
  const totalPay = totalPayRows.length > 0
    ? totalPayRows.reduce((s, r) => s + (r.totalPay ?? 0), 0)
    : null;

  const fmtCurrency = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const resolveCustomer = (code?: string) => {
    if (!code) return "";
    return customerLookup ? customerLookup(code) : code;
  };

  const driverSections = driverRows
    .filter((row) => row.stops.length > 0)
    .map((row) => {
      const stopRows = row.stops.map((stop) => {
        const endLoc = stop.status === "overnight" ? (stop.overnightLocation || stop.dropoffLocation) : stop.dropoffLocation;
        const customer = resolveCustomer(stop.customer);
        const statusDot = stop.status === "completed" ? "" : stop.status === "overnight" ? '<span style="color:#d97706;">⏸</span> ' : '<span style="color:#7c3aed;">⇄</span> ';
        return `
          <tr>
            <td style="padding:3px 6px;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;width:24px;">${stop.carCount}</td>
            <td style="padding:3px 6px;font-weight:500;color:#0f172a;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(customer || "—")}</td>
            <td style="padding:3px 6px;color:#475569;">${statusDot}${escapeHtml(stop.pickupLocation || "—")} <span style="color:#cbd5e1;">→</span> ${escapeHtml(endLoc || "—")}</td>
          </tr>
        `;
      }).join("");

      return `
        <div class="driver-card">
          <div class="driver-head">
            <div class="driver-name">${escapeHtml(row.driver.name)}</div>
            <div class="driver-stats">
              <span class="cars-pill">${row.totalCars} cars</span>
              ${row.totalPay !== null ? `<span class="pay-pill">${fmtCurrency(row.totalPay)}</span>` : ""}
            </div>
          </div>
          <table class="stop-table">${stopRows}</table>
        </div>
      `;
    }).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Driver Recap — ${escapeHtml(heading)}</title>
  <style>
    @page { size: letter landscape; margin: 0.4in; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 16px 20px; color: #0f172a; background: #ffffff; font-size: 11px; }
    .header { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, hsl(222, 47%, 16%) 0%, hsl(222, 47%, 24%) 100%); color: white; padding: 10px 16px; border-radius: 6px; margin-bottom: 10px; }
    .header-title { font-size: 14px; font-weight: 700; }
    .header-sub { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.75; font-weight: 600; }
    .header-date { font-size: 11px; opacity: 0.92; }
    .kpi-bar { display: flex; gap: 8px; margin-bottom: 12px; }
    .kpi { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 6px 10px; }
    .kpi-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-weight: 600; }
    .kpi-value { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; margin-top: 1px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .driver-card { border: 1px solid #e2e8f0; border-radius: 5px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
    .driver-head { display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .driver-name { font-weight: 700; font-size: 11px; color: #0f172a; }
    .driver-stats { display: flex; gap: 4px; }
    .cars-pill { background: #e2e8f0; color: #334155; font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 9999px; font-variant-numeric: tabular-nums; }
    .pay-pill { background: #d1fae5; color: #065f46; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 9999px; font-variant-numeric: tabular-nums; }
    .stop-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .stop-table tr { border-bottom: 1px solid #f1f5f9; }
    .stop-table tr:last-child { border-bottom: none; }
    .footer { margin-top: 8px; font-size: 8px; color: #94a3b8; text-align: center; padding-top: 4px; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-sub">Monroe Auto Transport · Driver Recap</div>
      <div class="header-title">${escapeHtml(heading)}</div>
    </div>
    <div class="header-date">Generated ${escapeHtml(new Date().toLocaleString())}</div>
  </div>

  <div class="kpi-bar">
    <div class="kpi"><div class="kpi-label">Cars Moved</div><div class="kpi-value">${totalCars}</div></div>
    <div class="kpi"><div class="kpi-label">Completed</div><div class="kpi-value" style="color:#047857;">${completedCars}</div></div>
    <div class="kpi"><div class="kpi-label">Held / Split</div><div class="kpi-value" style="color:#d97706;">${heldCars}</div></div>
    ${totalPay !== null ? `<div class="kpi"><div class="kpi-label">Total Pay</div><div class="kpi-value" style="color:#047857;">${fmtCurrency(totalPay)}</div></div>` : ""}
  </div>

  <div class="grid">${driverSections || '<p style="color:#94a3b8;text-align:center;padding:40px;grid-column:1/-1;">No driver activity recorded.</p>'}</div>

  <div class="footer">Monroe Auto Transport Fleet Manager</div>
</body>
</html>`;
}

/** Build a formatted weekly recap export as HTML. */
export function buildWeeklyExportText(
  weekStart: string,
  weekEnd: string,
  weekDates: string[],
  drivers: Driver[],
  boards: DriverBoardEntry[],
  planningSlots: Array<{ id: string; driverId?: string; date: string; loadId?: string; loadSummary?: string; pickupLocation?: string; deliveryLocation?: string; carCount?: number; customer?: string; notes?: string }> = [],
  loads: Array<{ id: string; pickupLocation?: string; deliveryLocation?: string; carIds?: string[]; customer?: string }> = [],
): string {
  const startLabel = new Date(`${weekStart}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = new Date(`${weekEnd}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dayNames = weekDates.map((d) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
  );

  const activeDrivers = drivers.filter((d) => d.status !== "inactive");
  const fmtCurrency = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const driverStats = activeDrivers.map((driver) => {
    const dayStops = weekDates.map((date) =>
      buildDriverStopsForDate(driver.id, date, planningSlots, loads, boards),
    );
    const dayCars = dayStops.map((stops) => stops.reduce((s, stop) => s + stop.carCount, 0));
    const dayPay = dayStops.map((stops) => getBoardPayTotal(stops, driver.payRatePerCar));
    const totalCars = dayCars.reduce((s, c) => s + c, 0);
    const totalPayVals = dayPay.filter((p) => p !== null) as number[];
    const totalPay = totalPayVals.length > 0 ? totalPayVals.reduce((s, p) => s + p, 0) : null;

    return { driver, dayCars, dayPay, totalCars, totalPay };
  }).filter((r) => r.totalCars > 0);

  const fleetCars = weekDates.map((_, i) => driverStats.reduce((s, r) => s + r.dayCars[i], 0));
  const fleetTotal = fleetCars.reduce((s, c) => s + c, 0);
  const fleetPayRows = driverStats.filter((r) => r.totalPay !== null);
  const fleetPay = fleetPayRows.length > 0
    ? fleetPayRows.reduce((s, r) => s + (r.totalPay ?? 0), 0)
    : null;

  const dayHeaders = dayNames.map((d) => `<th style="padding:8px 6px;text-align:center;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">${escapeHtml(d)}</th>`).join("");

  const driverRows = driverStats.map((row) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 12px;font-weight:600;color:#0f172a;">${escapeHtml(row.driver.name)}</td>
      ${row.dayCars.map((c) => `<td style="padding:10px 6px;text-align:center;font-variant-numeric:tabular-nums;color:${c > 0 ? "#0f172a" : "#cbd5e1"};">${c > 0 ? c : "—"}</td>`).join("")}
      <td style="padding:10px 12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:#0f172a;">${row.totalCars}</td>
      <td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums;color:#047857;font-weight:600;">${row.totalPay !== null ? fmtCurrency(row.totalPay) : "—"}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Weekly Recap — ${escapeHtml(startLabel)} to ${escapeHtml(endLabel)}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 32px 24px; color: #0f172a; background: #ffffff; }
    .header-band { background: linear-gradient(135deg, hsl(222, 47%, 16%) 0%, hsl(222, 47%, 24%) 100%); color: white; padding: 24px 28px; border-radius: 12px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="header-band">
    <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;opacity:0.7;font-weight:600;">Monroe Auto Transport</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px;">Weekly Recap</div>
    <div style="font-size:14px;opacity:0.85;margin-top:2px;">${escapeHtml(startLabel)} – ${escapeHtml(endLabel)}</div>
  </div>

  <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead style="background:#f8fafc;">
        <tr style="border-bottom:2px solid #e2e8f0;">
          <th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Driver</th>
          ${dayHeaders}
          <th style="padding:10px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Total</th>
          <th style="padding:10px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Pay</th>
        </tr>
      </thead>
      <tbody>${driverRows || '<tr><td colspan="' + (weekDates.length + 3) + '" style="padding:32px;text-align:center;color:#94a3b8;">No activity for this week.</td></tr>'}</tbody>
      ${driverStats.length > 0 ? `
        <tfoot style="background:#f8fafc;border-top:2px solid #e2e8f0;">
          <tr>
            <td style="padding:12px;font-weight:700;text-transform:uppercase;font-size:11px;color:#0f172a;letter-spacing:0.05em;">Fleet Total</td>
            ${fleetCars.map((c) => `<td style="padding:12px 6px;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;color:#0f172a;">${c > 0 ? c : "—"}</td>`).join("")}
            <td style="padding:12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:#0f172a;">${fleetTotal}</td>
            <td style="padding:12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:#047857;">${fleetPay !== null ? fmtCurrency(fleetPay) : "—"}</td>
          </tr>
        </tfoot>
      ` : ""}
    </table>
  </div>

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
    Generated ${escapeHtml(new Date().toLocaleString())} · Monroe Auto Transport Fleet Manager
  </div>
</body>
</html>`;
}
