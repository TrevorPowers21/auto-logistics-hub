import { useEffect, useMemo, useState } from "react";
import { DriverAnalyticsTab } from "@/components/DriverAnalyticsTab";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { useStoreData } from "@/hooks/use-store";
import {
  buildDailyExportText,
  buildWeeklyExportText,
  createEmptyStop,
  getBoardPayTotal,
  getBoardTotals,
  getStopPay,
  getYesterdayDate,
  normalizeBoardStops,
  sanitizeBoardStops,
  formatRecapHeadingShort,
} from "@/lib/driver-recap";
import { generateId, getLocations, getDriverBoards, getDrivers, saveDriverBoards, saveLocations } from "@/lib/store";
import { Driver, DriverBoardEntry, DriverBoardStop, LocationProfile } from "@/lib/types";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Download, Plus, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, format, startOfWeek, addWeeks } from "date-fns";

type DriverSheetRow = {
  id: string;
  driver: Driver;
  board?: DriverBoardEntry;
  stops: DriverBoardStop[];
  totalCars: number;
  completedCars: number;
  heldCars: number;
  totalPay: number | null;
};

type LocationTotal = {
  location: string;
  cars: number;
};

export default function DriverRecapPage() {
  const drivers = useStoreData(getDrivers);
  const boards = useStoreData(getDriverBoards);
  const locations = useStoreData(getLocations);
  const [date, setDate] = useState(getYesterdayDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const locationOptions = useMemo(() => locations.slice().sort((a, b) => a.code.localeCompare(b.code)), [locations]);

  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.status !== "inactive"),
    [drivers],
  );

  const driverRows = useMemo<DriverSheetRow[]>(() => {
    return activeDrivers.map((driver) => {
      const board = boards.find((e) => e.driverId === driver.id && e.date === date);
      const stops = normalizeBoardStops(board);
      const totals = getBoardTotals(stops, driver.payRatePerCar);
      return { id: driver.id, driver, board, stops, ...totals };
    });
  }, [boards, date, activeDrivers]);

  const pickupRecap = useMemo(() => buildLocationRecap(driverRows, "pickup"), [driverRows]);
  const dropoffRecap = useMemo(() => buildLocationRecap(driverRows, "dropoff"), [driverRows]);

  const dayTotals = useMemo(() => {
    const totalCars = driverRows.reduce((s, r) => s + r.totalCars, 0);
    const completedCars = driverRows.reduce((s, r) => s + r.completedCars, 0);
    const heldCars = driverRows.reduce((s, r) => s + r.heldCars, 0);
    const payRows = driverRows.filter((r) => r.totalPay !== null);
    const totalPay = payRows.length > 0 ? payRows.reduce((s, r) => s + (r.totalPay ?? 0), 0) : null;
    return { totalCars, completedCars, heldCars, totalPay };
  }, [driverRows]);

  // Weekly view
  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(`${date}T12:00:00`), { weekStartsOn: 1 });
    return addWeeks(base, weekOffset);
  }, [date, weekOffset]);

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd")),
    [weekStart],
  );

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const weeklyRows = useMemo(() => {
    return activeDrivers.map((driver) => {
      const dayCars = weekDates.map((d) => {
        const board = boards.find((b) => b.driverId === driver.id && b.date === d);
        const stops = normalizeBoardStops(board);
        return stops.reduce((s, stop) => s + stop.carCount, 0);
      });
      const dayPay = weekDates.map((d) => {
        const board = boards.find((b) => b.driverId === driver.id && b.date === d);
        const stops = normalizeBoardStops(board);
        return getBoardPayTotal(stops, driver.payRatePerCar);
      });
      const totalCars = dayCars.reduce((s, c) => s + c, 0);
      const payVals = dayPay.filter((p): p is number => p !== null);
      const totalPay = payVals.length > 0 ? payVals.reduce((s, p) => s + p, 0) : null;
      return { driver, dayCars, dayPay, totalCars, totalPay };
    }).filter((r) => r.totalCars > 0);
  }, [activeDrivers, boards, weekDates]);

  const handleSaveStops = (driverId: string, stops: DriverBoardStop[]) => {
    const sanitized = sanitizeBoardStops(stops);
    const existing = boards.find((e) => e.driverId === driverId && e.date === date);
    const next: DriverBoardEntry = {
      id: existing?.id || generateId(),
      driverId,
      date,
      items: sanitized.map((s) => `${s.carCount}-${s.pickupLocation}`),
      stops: sanitized,
      updatedAt: new Date().toISOString(),
    };
    const remaining = boards.filter((e) => !(e.driverId === driverId && e.date === date));
    saveDriverBoards([...remaining, next]);
    toast("Driver sheet saved", { description: "Loads updated successfully." });
  };

  const handleCreateLocation = (rawValue: string): string => {
    const value = rawValue.trim();
    if (!value) return "";
    const upper = value.toUpperCase();
    const existing = locations.find((l) => l.code === upper || l.name.toUpperCase() === upper);
    if (existing) return existing.code;
    const next: LocationProfile = {
      id: generateId(), code: upper, name: value,
      contactName: "", phone: "", email: "", address: "", notes: "",
    };
    saveLocations([...locations, next]);
    toast("Customer added", { description: `${next.code} was added to Customers.` });
    return next.code;
  };

  const handleExportDay = () => {
    const text = buildDailyExportText(date, driverRows, pickupRecap, dropoffRecap);
    downloadText(text, `recap-${date}.txt`);
  };

  const handleExportWeek = () => {
    const text = buildWeeklyExportText(weekStartStr, weekEndStr, weekDates, drivers, boards);
    downloadText(text, `weekly-recap-${weekStartStr}.txt`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Tabs defaultValue="daily">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Driver Recap</h1>
            <p className="text-muted-foreground text-sm mt-1">Daily sheets, pay tracking, and weekly summaries</p>
          </div>
          <TabsList>
            <TabsTrigger value="daily">Daily Sheet</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Summary</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
        </div>

        {/* ───────────── DAILY TAB ───────────── */}
        <TabsContent value="daily" className="space-y-6 mt-0">
          {/* Date picker + export */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2 max-w-xs">
                  <Label>Date</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span>{format(new Date(`${date}T12:00:00`), "EEEE, MMMM d, yyyy")}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={new Date(`${date}T12:00:00`)}
                        onSelect={(d) => { if (d) { setDate(format(d, "yyyy-MM-dd")); setCalendarOpen(false); } }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button variant="outline" onClick={handleExportDay} disabled={dayTotals.totalCars === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Day
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Day metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total Cars" value={dayTotals.totalCars} />
            <MetricCard label="Completed" value={dayTotals.completedCars} accent="text-emerald-600" />
            <MetricCard label="Split" value={dayTotals.heldCars} accent="text-amber-600" />
            <MetricCard
              label="Total Pay"
              value={dayTotals.totalPay !== null ? `$${dayTotals.totalPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
              accent="text-primary"
            />
          </div>

          {/* Pickup / Dropoff recap */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pickup Recap</CardTitle>
                <CardDescription>Cars grouped by pickup location</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pickupRecap.length > 0 ? pickupRecap.map((item) => (
                  <LocationRow key={item.location} location={item.location} cars={item.cars} />
                )) : (
                  <p className="text-sm text-muted-foreground">No pickup data for this date.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Drop-off Recap</CardTitle>
                <CardDescription>Cars grouped by final delivered or split location</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dropoffRecap.length > 0 ? dropoffRecap.map((item) => (
                  <LocationRow key={item.location} location={item.location} cars={item.cars} />
                )) : (
                  <p className="text-sm text-muted-foreground">No drop-off data for this date.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Driver cards */}
          <div className="grid gap-4 xl:grid-cols-2">
            {driverRows.map((row) => (
              <DriverLoadTable
                key={row.id}
                row={row}
                locationOptions={locationOptions}
                onCreateLocation={handleCreateLocation}
                onSave={handleSaveStops}
              />
            ))}
          </div>
        </TabsContent>

        {/* ───────────── WEEKLY TAB ───────────── */}
        <TabsContent value="weekly" className="space-y-6 mt-0">
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[200px] text-center">
                    {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {weekOffset !== 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                      This week
                    </Button>
                  )}
                </div>
                <Button variant="outline" onClick={handleExportWeek} disabled={weeklyRows.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Week
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {weeklyRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-muted-foreground">No data logged for this week.</p>
                </div>
              ) : (
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Driver</TableHead>
                      {weekDates.map((d) => (
                        <TableHead key={d} className="text-center w-[70px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{format(new Date(`${d}T12:00:00`), "EEE")}</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {formatRecapHeadingShort(d).split(",")[0]}
                            </span>
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Total Cars</TableHead>
                      <TableHead className="text-right">Week Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyRows.map((row) => (
                      <TableRow key={row.driver.id}>
                        <TableCell className="font-medium">{row.driver.name}</TableCell>
                        {row.dayCars.map((cars, i) => (
                          <TableCell
                            key={weekDates[i]}
                            className="text-center tabular-nums cursor-pointer hover:bg-muted/60"
                            onClick={() => {
                              setDate(weekDates[i]);
                            }}
                          >
                            {cars > 0 ? (
                              <span className="font-medium">{cars}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums font-semibold">
                          {row.totalCars}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.totalPay !== null ? (
                            <span className="font-medium text-emerald-700">
                              ${row.totalPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Week totals summary cards */}
          {weeklyRows.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                label="Week Total Cars"
                value={weeklyRows.reduce((s, r) => s + r.totalCars, 0)}
              />
              <MetricCard
                label="Drivers Active"
                value={weeklyRows.length}
              />
              <MetricCard
                label="Week Total Pay"
                value={(() => {
                  const rows = weeklyRows.filter((r) => r.totalPay !== null);
                  if (rows.length === 0) return "—";
                  const total = rows.reduce((s, r) => s + (r.totalPay ?? 0), 0);
                  return `$${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
                })()}
                accent="text-primary"
              />
            </div>
          )}
        </TabsContent>
        {/* ───────────── ANALYTICS TAB ───────────── */}
        <TabsContent value="analytics" className="space-y-6 mt-0">
          <DriverAnalyticsTab boards={boards} drivers={drivers} referenceDate={date} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Driver Load Table ────────────────────────────────────────────────────────

function DriverLoadTable({
  row,
  locationOptions,
  onCreateLocation,
  onSave,
}: {
  row: DriverSheetRow;
  locationOptions: LocationProfile[];
  onCreateLocation: (value: string) => string;
  onSave: (driverId: string, stops: DriverBoardStop[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stops, setStops] = useState<DriverBoardStop[]>([]);

  useEffect(() => {
    setStops(row.stops.length > 0 ? row.stops : [createEmptyStop()]);
  }, [row.stops]);

  const updateStop = (index: number, patch: Partial<DriverBoardStop>) => {
    setStops((current) => current.map((stop, i) => i === index ? { ...stop, ...patch } : stop));
  };

  const addStop = () => setStops((current) => [...current, createEmptyStop()]);
  const removeStop = (index: number) =>
    setStops((current) => current.length === 1 ? current : current.filter((_, i) => i !== index));

  const handleSave = () => { onSave(row.id, stops); setOpen(false); };

  const payRate = row.driver.payRatePerCar;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{row.driver.name}</CardTitle>
              <CardDescription className="mt-0.5">
                {row.totalCars} cars
                {row.completedCars > 0 && ` · ${row.completedCars} completed`}
                {row.heldCars > 0 && ` · ${row.heldCars} split`}
              </CardDescription>
            </div>
            {row.totalPay !== null ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 shrink-0">
                ${row.totalPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Badge>
            ) : payRate !== undefined ? (
              <Badge variant="secondary" className="text-muted-foreground shrink-0">
                ${payRate}/car
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Cars</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Dropoff</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20 text-right">Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.stops.length > 0 ? row.stops.map((stop) => {
                  const stopPay = getStopPay(stop, payRate);
                  return (
                    <TableRow key={stop.id}>
                      <TableCell className="tabular-nums font-medium">{stop.carCount}</TableCell>
                      <TableCell className="text-sm">{stop.pickupLocation || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {stop.status === "held_overnight"
                          ? <span>{stop.overnightLocation || stop.dropoffLocation || "—"} <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs ml-1">Split</Badge></span>
                          : stop.dropoffLocation || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={stop.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"}
                        >
                          {stop.status === "completed" ? "Done" : "Split"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {stopPay !== null
                          ? `$${stopPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      No loads entered for this driver.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setOpen(true)}>Edit Loads</Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {row.driver.name} — Loads
              {row.driver.payRatePerCar !== undefined && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  Default rate: ${row.driver.payRatePerCar}/car
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            {stops.map((stop, index) => {
              const stopPay = getStopPay(stop, payRate);
              return (
                <div key={stop.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold">Load {index + 1}</p>
                      {stopPay !== null && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                          ${stopPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeStop(index)}>
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Number of Cars">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={String(stop.carCount)}
                        onChange={(e) => updateStop(index, { carCount: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                        placeholder="0"
                      />
                    </Field>

                    <Field label={`Pay Rate ($/car)${payRate !== undefined ? ` — default $${payRate}` : ""}`}>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={stop.payRatePerCar !== undefined ? String(stop.payRatePerCar) : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateStop(index, {
                            payRatePerCar: val === "" ? undefined : Number(val),
                          });
                        }}
                        placeholder={payRate !== undefined ? `${payRate} (driver default)` : "Enter rate"}
                      />
                    </Field>

                    <Field label="Completed or Split">
                      <Select
                        value={stop.status}
                        onValueChange={(v) => updateStop(index, { status: v as DriverBoardStop["status"] })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="held_overnight">Split (held overnight)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Pickup Location">
                      <SearchableLocationSelect
                        value={stop.pickupLocation}
                        options={locationOptions}
                        placeholder="Select pickup"
                        onCreateLocation={onCreateLocation}
                        onValueChange={(v) => updateStop(index, { pickupLocation: v })}
                      />
                    </Field>

                    <Field label="Dropoff Location">
                      <SearchableLocationSelect
                        value={stop.dropoffLocation}
                        options={locationOptions}
                        placeholder="Select dropoff"
                        onCreateLocation={onCreateLocation}
                        onValueChange={(v) => updateStop(index, { dropoffLocation: v })}
                      />
                    </Field>

                    {stop.status === "held_overnight" && (
                      <Field label="Split / Overnight Location">
                        <SearchableLocationSelect
                          value={stop.overnightLocation || ""}
                          options={locationOptions}
                          placeholder="Where are they being held?"
                          onCreateLocation={onCreateLocation}
                          onValueChange={(v) => updateStop(index, { overnightLocation: v })}
                        />
                      </Field>
                    )}

                    <div className={stop.status === "held_overnight" ? "md:col-span-2" : ""}>
                      <Field label="Notes / Issues">
                        <Textarea
                          value={stop.notes || ""}
                          onChange={(e) => updateStop(index, { notes: e.target.value })}
                          rows={2}
                          placeholder="Hold reason, issues, or notes for this load"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between gap-2 pt-2 border-t">
            <Button variant="outline" onClick={addStop}>
              <Plus className="mr-2 h-4 w-4" /> Add Load
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLocationRecap(rows: DriverSheetRow[], type: "pickup" | "dropoff"): LocationTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const stop of row.stops) {
      const loc = type === "pickup"
        ? stop.pickupLocation
        : (stop.status === "held_overnight"
            ? (stop.overnightLocation || stop.dropoffLocation)
            : stop.dropoffLocation);
      if (!loc) continue;
      totals.set(loc, (totals.get(loc) || 0) + stop.carCount);
    }
  }
  return Array.from(totals.entries())
    .map(([location, cars]) => ({ location, cars }))
    .sort((a, b) => b.cars - a.cars);
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-2xl font-bold tabular-nums", accent)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function LocationRow({ location, cars }: { location: string; cars: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-2.5">
      <span className="font-medium text-sm">{location}</span>
      <span className="text-sm text-muted-foreground tabular-nums">{cars} car{cars === 1 ? "" : "s"}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SearchableLocationSelect({
  value, options, placeholder, onCreateLocation, onValueChange,
}: {
  value: string;
  options: LocationProfile[];
  placeholder: string;
  onCreateLocation: (value: string) => string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.code === value);
  const canCreate = query.trim().length > 0 && !options.some((o) => {
    const n = query.trim().toUpperCase();
    return o.code === n || o.name.toUpperCase() === n;
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal text-sm">
          {selected ? `${selected.code} — ${selected.name}` : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search locations..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.code} ${o.name} ${o.contactName} ${o.address}`}
                  onSelect={() => { onValueChange(o.code); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.code ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="text-sm">{o.code} — {o.name}</span>
                    {(o.contactName || o.address) && (
                      <span className="text-xs text-muted-foreground">{o.contactName || o.address}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem
                  value={`create:${query}`}
                  onSelect={() => {
                    const code = onCreateLocation(query);
                    if (code) onValueChange(code);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm">Create "{query.trim()}"</span>
                    <span className="text-xs text-muted-foreground">Add a new customer location</span>
                  </div>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandEmpty>No location found.</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
