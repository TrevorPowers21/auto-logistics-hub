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
        const stopPay = getStopPay(stop, row.driver.payRatePerCar);
        const customer = resolveCustomer(stop.customer);
        return `
          <tr>
            <td style="padding:8px 12px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums;">${stop.carCount}</td>
            <td style="padding:8px 12px;">${escapeHtml(customer || "—")}</td>
            <td style="padding:8px 12px;color:#475569;">${escapeHtml(stop.pickupLocation || "—")} <span style="color:#94a3b8;">→</span> ${escapeHtml(endLoc || "—")}</td>
            <td style="padding:8px 12px;text-align:center;">${statusBadge(stop.status)}</td>
            <td style="padding:8px 12px;text-align:right;font-variant-numeric:tabular-nums;color:#047857;font-weight:600;">${stopPay !== null ? fmtCurrency(stopPay) : "—"}</td>
          </tr>
          ${stop.notes ? `<tr><td colspan="5" style="padding:0 12px 8px;color:#94a3b8;font-style:italic;font-size:12px;">${escapeHtml(stop.notes)}</td></tr>` : ""}
        `;
      }).join("");

      return `
        <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div>
              <div style="font-weight:700;font-size:15px;color:#0f172a;">${escapeHtml(row.driver.name)}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${row.totalCars} cars${row.heldCars > 0 ? ` · ${row.heldCars} held` : ""}</div>
            </div>
            ${row.totalPay !== null ? `<div style="font-weight:700;color:#047857;font-size:16px;font-variant-numeric:tabular-nums;">${fmtCurrency(row.totalPay)}</div>` : ""}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f8fafc;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">
                <th style="padding:6px 12px;text-align:center;font-weight:600;">Cars</th>
                <th style="padding:6px 12px;text-align:left;font-weight:600;">Customer</th>
                <th style="padding:6px 12px;text-align:left;font-weight:600;">Route</th>
                <th style="padding:6px 12px;text-align:center;font-weight:600;">Status</th>
                <th style="padding:6px 12px;text-align:right;font-weight:600;">Pay</th>
              </tr>
            </thead>
            <tbody>${stopRows}</tbody>
          </table>
        </div>
      `;
    }).join("");

  const recapColumns = (title: string, rows: Array<{ location: string; cars: number }>) => `
    <div style="flex:1;min-width:220px;">
      <h3 style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">${title}</h3>
      ${rows.length === 0 ? '<p style="color:#94a3b8;font-size:13px;">None</p>' : `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${rows.map((r) => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:6px 4px;color:#0f172a;">${escapeHtml(r.location)}</td>
              <td style="padding:6px 4px;text-align:right;font-variant-numeric:tabular-nums;color:#475569;">${r.cars} car${r.cars === 1 ? "" : "s"}</td>
            </tr>
          `).join("")}
        </table>
      `}
    </div>
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Driver Recap — ${escapeHtml(heading)}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 32px 24px; color: #0f172a; background: #ffffff; }
    .header-band { background: linear-gradient(135deg, hsl(222, 47%, 16%) 0%, hsl(222, 47%, 24%) 100%); color: white; padding: 24px 28px; border-radius: 12px; margin-bottom: 24px; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; flex: 1; min-width: 140px; }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 600; }
    .stat-value { font-size: 24px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; color: #0f172a; }
  </style>
</head>
<body>
  <div class="header-band">
    <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;opacity:0.7;font-weight:600;">Monroe Auto Transport</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px;">Driver Recap</div>
    <div style="font-size:14px;opacity:0.85;margin-top:2px;">${escapeHtml(heading)}</div>
  </div>

  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">
    <div class="stat-card"><div class="stat-label">Cars Moved</div><div class="stat-value">${totalCars}</div></div>
    <div class="stat-card"><div class="stat-label">Completed</div><div class="stat-value">${completedCars}</div></div>
    <div class="stat-card"><div class="stat-label">Held / Split</div><div class="stat-value">${heldCars}</div></div>
    ${totalPay !== null ? `<div class="stat-card"><div class="stat-label">Total Pay</div><div class="stat-value" style="color:#047857;">${fmtCurrency(totalPay)}</div></div>` : ""}
  </div>

  ${driverSections || '<p style="color:#94a3b8;text-align:center;padding:40px;">No driver activity recorded for this day.</p>'}

  <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
    ${recapColumns("Pickup Locations", pickupRecap)}
    ${recapColumns("Drop-off Locations", dropoffRecap)}
  </div>

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
    Generated ${escapeHtml(new Date().toLocaleString())} · Monroe Auto Transport Fleet Manager
  </div>
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
): string {
  const startLabel = new Date(`${weekStart}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = new Date(`${weekEnd}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dayNames = weekDates.map((d) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
  );

  const activeDrivers = drivers.filter((d) => d.status !== "inactive");
  const fmtCurrency = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
