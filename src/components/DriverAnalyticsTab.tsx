import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell,
} from "recharts";
import { Driver, DriverBoardEntry } from "@/lib/types";
import { normalizeBoardStops, getBoardPayTotal, getBoardTotals } from "@/lib/driver-recap";
import {
  addDays, addMonths, format, startOfWeek, startOfMonth,
  endOfMonth, eachDayOfInterval, getDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "day" | "week" | "month";

interface DateRange {
  dates: string[];
  label: string;
  groups: { key: string; label: string; dates: string[] }[];
}

interface DriverStat {
  driver: Driver;
  dailyData: { date: string; totalCars: number; completedCars: number; heldCars: number; pay: number | null }[];
  totalCars: number;
  completedCars: number;
  heldCars: number;
  totalPay: number | null;
  color: string;
}

// ─── Color palette ────────────────────────────────────────────────────────────

const DRIVER_COLORS = [
  "#0d9488", // teal
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
  "#d97706", // amber
  "#16a34a", // green
  "#0891b2", // cyan
  "#9333ea", // purple
];

function driverColor(index: number): string {
  return DRIVER_COLORS[index % DRIVER_COLORS.length];
}

// ─── Date range helpers ───────────────────────────────────────────────────────

function getRange(period: Period, referenceDate: string, offset: number): DateRange {
  const ref = new Date(`${referenceDate}T12:00:00`);

  if (period === "day") {
    const d = addDays(ref, offset);
    const dateStr = format(d, "yyyy-MM-dd");
    return {
      dates: [dateStr],
      label: format(d, "EEEE, MMMM d, yyyy"),
      groups: [{ key: dateStr, label: format(d, "EEE M/d"), dates: [dateStr] }],
    };
  }

  if (period === "week") {
    const weekStart = addDays(startOfWeek(ref, { weekStartsOn: 1 }), offset * 7);
    const dates = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));
    return {
      dates,
      label: `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`,
      groups: dates.map((d) => ({
        key: d,
        label: format(new Date(`${d}T12:00:00`), "EEE"),
        dates: [d],
      })),
    };
  }

  // month
  const monthStart = startOfMonth(addMonths(ref, offset));
  const monthEnd = endOfMonth(monthStart);
  const allDates = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((d) =>
    format(d, "yyyy-MM-dd"),
  );

  // Group into Mon-Sun weeks
  const weeks: DateRange["groups"] = [];
  let bucket: string[] = [];
  let weekNum = 1;
  for (const date of allDates) {
    const dow = getDay(new Date(`${date}T12:00:00`));
    if (dow === 1 && bucket.length > 0) {
      weeks.push({
        key: `w${weekNum}`,
        label: `Wk ${weekNum} (${format(new Date(`${bucket[0]}T12:00:00`), "M/d")})`,
        dates: bucket,
      });
      bucket = [];
      weekNum++;
    }
    bucket.push(date);
  }
  if (bucket.length > 0) {
    weeks.push({
      key: `w${weekNum}`,
      label: `Wk ${weekNum} (${format(new Date(`${bucket[0]}T12:00:00`), "M/d")})`,
      dates: bucket,
    });
  }

  return { dates: allDates, label: format(monthStart, "MMMM yyyy"), groups: weeks };
}

// ─── Data aggregation ─────────────────────────────────────────────────────────

function computeDriverStats(
  drivers: Driver[],
  boards: DriverBoardEntry[],
  dates: string[],
): DriverStat[] {
  return drivers
    .filter((d) => d.status !== "inactive")
    .map((driver, index) => {
      const dailyData = dates.map((date) => {
        const board = boards.find((b) => b.driverId === driver.id && b.date === date);
        const stops = normalizeBoardStops(board);
        const totals = getBoardTotals(stops, driver.payRatePerCar);
        const pay = getBoardPayTotal(stops, driver.payRatePerCar);
        return { date, ...totals, pay };
      });

      const totalCars = dailyData.reduce((s, d) => s + d.totalCars, 0);
      const completedCars = dailyData.reduce((s, d) => s + d.completedCars, 0);
      const heldCars = dailyData.reduce((s, d) => s + d.heldCars, 0);
      const payDays = dailyData.filter((d) => d.pay !== null);
      const totalPay = payDays.length > 0 ? payDays.reduce((s, d) => s + (d.pay ?? 0), 0) : null;

      return { driver, dailyData, totalCars, completedCars, heldCars, totalPay, color: driverColor(index) };
    })
    .filter((r) => r.totalCars > 0);
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, valueFormatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill?: string; color?: string }>;
  label?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter ?? ((v: number) => String(v));
  return (
    <div className="rounded-xl border bg-white px-4 py-3 shadow-lg text-sm min-w-[160px]">
      {label && <p className="font-semibold mb-2 text-foreground">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: entry.fill || entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium tabular-nums">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DriverAnalyticsTab({
  boards,
  drivers,
  referenceDate,
}: {
  boards: DriverBoardEntry[];
  drivers: Driver[];
  referenceDate: string;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);

  const range = useMemo(() => getRange(period, referenceDate, offset), [period, referenceDate, offset]);
  const driverStats = useMemo(
    () => computeDriverStats(drivers, boards, range.dates),
    [drivers, boards, range.dates],
  );

  const totals = useMemo(() => ({
    totalCars: driverStats.reduce((s, r) => s + r.totalCars, 0),
    completedCars: driverStats.reduce((s, r) => s + r.completedCars, 0),
    heldCars: driverStats.reduce((s, r) => s + r.heldCars, 0),
    totalPay: (() => {
      const rows = driverStats.filter((r) => r.totalPay !== null);
      return rows.length > 0 ? rows.reduce((s, r) => s + (r.totalPay ?? 0), 0) : null;
    })(),
  }), [driverStats]);

  // Trend chart: groups on X, stacked bars per driver
  const trendData = useMemo(() =>
    range.groups.map((group) => {
      const entry: Record<string, string | number> = { group: group.label };
      for (const row of driverStats) {
        entry[row.driver.name] = group.dates.reduce((s, date) => {
          const day = row.dailyData.find((d) => d.date === date);
          return s + (day?.totalCars ?? 0);
        }, 0);
      }
      return entry;
    }),
    [range.groups, driverStats],
  );

  // Cars by driver (horizontal bar)
  const driverCarsData = useMemo(() =>
    [...driverStats]
      .sort((a, b) => b.totalCars - a.totalCars)
      .map((r) => ({ name: r.driver.name, cars: r.totalCars, color: r.color })),
    [driverStats],
  );

  // Completed vs Split per driver
  const completedSplitData = useMemo(() =>
    driverStats.map((r) => ({
      name: r.driver.name.split(" ")[0], // first name for brevity
      Completed: r.completedCars,
      Split: r.heldCars,
    })),
    [driverStats],
  );

  // Pay by driver
  const payData = useMemo(() =>
    driverStats
      .filter((r) => r.totalPay !== null)
      .sort((a, b) => (b.totalPay ?? 0) - (a.totalPay ?? 0))
      .map((r) => ({ name: r.driver.name, pay: r.totalPay ?? 0, color: r.color })),
    [driverStats],
  );

  const hasTrendData = trendData.some((row) =>
    driverStats.some((r) => (row[r.driver.name] as number) > 0),
  );

  const periodOptions: { value: Period; label: string }[] = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ];

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Period selector */}
            <div className="flex rounded-lg border p-1 gap-1 bg-muted/30 w-fit">
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handlePeriodChange(opt.value)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                    period === opt.value
                      ? "bg-white shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Date navigation */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[220px] text-center">{range.label}</span>
              <Button variant="outline" size="icon" onClick={() => setOffset((o) => o + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {offset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
                  Current
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Cars" value={totals.totalCars} sub={driverStats.length > 0 ? `${driverStats.length} active drivers` : undefined} />
        <SummaryCard label="Completed" value={totals.completedCars} accent="text-emerald-600"
          sub={totals.totalCars > 0 ? `${Math.round((totals.completedCars / totals.totalCars) * 100)}%` : undefined}
        />
        <SummaryCard label="Split" value={totals.heldCars} accent="text-amber-600"
          sub={totals.totalCars > 0 ? `${Math.round((totals.heldCars / totals.totalCars) * 100)}%` : undefined}
        />
        <SummaryCard
          label="Total Pay"
          value={totals.totalPay !== null
            ? `$${totals.totalPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
            : "—"}
          accent="text-primary"
          sub={totals.totalPay !== null && driverStats.length > 0
            ? `avg $${(totals.totalPay / driverStats.length).toLocaleString("en-US", { maximumFractionDigits: 0 })}/driver`
            : undefined}
        />
      </div>

      {driverStats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">No driver data found for this period.</p>
            <p className="text-xs text-muted-foreground mt-1">Enter loads on the Daily Sheet to see analytics here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Trend chart */}
          {hasTrendData && period !== "day" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cars Moved — {period === "week" ? "Daily Trend" : "Weekly Trend"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} barSize={period === "week" ? 28 : 20}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="group" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} cars`} />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                      {driverStats.map((row) => (
                        <Bar key={row.driver.id} dataKey={row.driver.name} stackId="a" fill={row.color} radius={[0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cars by driver + Completed vs Split */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Cars by driver — horizontal bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cars by Driver</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={driverCarsData}
                      layout="vertical"
                      margin={{ left: 0, right: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={110}
                        tickFormatter={(v: string) => v.split(" ")[0] + " " + (v.split(" ")[1]?.[0] ?? "") + "."}
                      />
                      <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} cars`} />} />
                      <Bar dataKey="cars" radius={[0, 4, 4, 0]}>
                        {driverCarsData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Completed vs Split */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Completed vs Split</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completedSplitData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} cars`} />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                      <Bar dataKey="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Split" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pay by driver (only if pay data exists) */}
          {payData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pay by Driver</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={payData}
                      layout="vertical"
                      margin={{ left: 0, right: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={110}
                        tickFormatter={(v: string) => v.split(" ")[0] + " " + (v.split(" ")[1]?.[0] ?? "") + "."}
                      />
                      <Tooltip
                        content={
                          <ChartTooltip
                            valueFormatter={(v) =>
                              `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                            }
                          />
                        }
                      />
                      <Bar dataKey="pay" radius={[0, 4, 4, 0]}>
                        {payData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Driver pay table */}
                <div className="mt-6 space-y-2">
                  {payData.map((row, i) => (
                    <div key={row.name} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                      <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: row.color }} />
                      <span className="flex-1 font-medium">{row.name}</span>
                      <span className="tabular-nums font-semibold">
                        ${row.pay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 text-sm pt-2 border-t">
                    <span className="w-5" />
                    <span className="w-2.5" />
                    <span className="flex-1 font-semibold">Total</span>
                    <span className="tabular-nums font-bold">
                      ${payData.reduce((s, r) => s + r.pay, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Driver breakdown table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Driver Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Driver</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cars</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Completed</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Split</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Completion %</th>
                    {payData.length > 0 && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Pay</th>}
                  </tr>
                </thead>
                <tbody>
                  {driverStats.sort((a, b) => b.totalCars - a.totalCars).map((row) => {
                    const pct = row.totalCars > 0
                      ? Math.round((row.completedCars / row.totalCars) * 100)
                      : 0;
                    return (
                      <tr key={row.driver.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: row.color }} />
                            <span className="font-medium">{row.driver.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{row.totalCars}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{row.completedCars}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-700">{row.heldCars}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                        {payData.length > 0 && (
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {row.totalPay !== null
                              ? `$${row.totalPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                              : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{totals.totalCars}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{totals.completedCars}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{totals.heldCars}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {totals.totalCars > 0 ? `${Math.round((totals.completedCars / totals.totalCars) * 100)}%` : "—"}
                    </td>
                    {payData.length > 0 && (
                      <td className="px-4 py-3 text-right tabular-nums">
                        {totals.totalPay !== null
                          ? `$${totals.totalPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label, value, accent, sub,
}: {
  label: string;
  value: string | number;
  accent?: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-2xl font-bold tabular-nums", accent)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
