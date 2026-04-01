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
import { generateId, getLocations, getAddresses, getDriverBoards, getDrivers, getPlanningSlots, saveDriverBoards, saveLocations, saveAddresses } from "@/lib/store";
import { Address, Driver, DriverBoardEntry, DriverBoardStop, LocationProfile, PlanningSlot } from "@/lib/types";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Download, Plus, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, format, startOfWeek, addWeeks } from "date-fns";

type CarriedOverStop = {
  carCount: number;
  pickupLocation: string; // "SHOP" since they were held overnight
  dropoffLocation: string; // where they need to go today
  fromDate: string;
};

type DriverSheetRow = {
  id: string;
  driver: Driver;
  board?: DriverBoardEntry;
  stops: DriverBoardStop[];
  carriedOver: CarriedOverStop[]; // overnight holds from previous day
  fromPlanning: boolean; // true if stops came from Planning Board (not yet saved)
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
  const planningSlots = useStoreData(getPlanningSlots);
  const locations = useStoreData(getLocations);
  const addresses = useStoreData(getAddresses);
  const [date, setDate] = useState(getYesterdayDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const locationOptions = useMemo(() => locations.slice().sort((a, b) => a.name.localeCompare(b.name)), [locations]);
  const addressOptions = useMemo(() => addresses.slice().sort((a, b) => a.name.localeCompare(b.name)), [addresses]);

  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.status !== "inactive"),
    [drivers],
  );

  // Get previous day for carryover check
  const prevDate = useMemo(() => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return format(d, "yyyy-MM-dd");
  }, [date]);

  // Convert planning slots into board stops when no board entry exists
  const planningStopsForDriver = (driverId: string, forDate: string): DriverBoardStop[] => {
    const driverSlots = planningSlots.filter((s) => s.driverId === driverId && s.date === forDate);
    if (driverSlots.length === 0) return [];
    return driverSlots.map((slot) => ({
      id: `plan-${slot.id}`,
      carCount: slot.carCount || 0,
      pickupLocation: slot.pickupLocation || "",
      dropoffLocation: slot.deliveryLocation || "",
      status: "completed" as const,
      notes: slot.notes || "",
    }));
  };

  // Auto-save: if a driver has planning data but no board entry, save it immediately
  // so Susan can review without anyone needing to manually hit save
  const autoSavedRef = useMemo(() => new Set<string>(), []);

  const driverRows = useMemo<DriverSheetRow[]>(() => {
    const boardsToAutoSave: DriverBoardEntry[] = [];

    const rows = activeDrivers.map((driver) => {
      const board = boards.find((e) => e.driverId === driver.id && e.date === date);

      // If no board entry, check for planning data or carryovers to auto-save
      let stops: DriverBoardStop[];
      let fromPlanning = false;

      if (board) {
        stops = normalizeBoardStops(board);
      } else {
        const planStops = planningStopsForDriver(driver.id, date);

        // Also check previous day for overnight carryovers to include
        const prevBoard = boards.find((e) => e.driverId === driver.id && e.date === prevDate);
        const prevStops = normalizeBoardStops(prevBoard);
        const carryoverStops: DriverBoardStop[] = prevStops
          .filter((s) => s.status === "overnight")
          .map((s) => ({
            id: `carry-${s.id}`,
            carCount: s.carCount,
            pickupLocation: "SHOP",
            dropoffLocation: s.dropoffLocation || "",
            status: "completed" as const,
            notes: "Carryover from yesterday",
          }));

        stops = [...carryoverStops, ...planStops];
        fromPlanning = stops.length > 0;

        // Auto-save so it's persisted without manual intervention
        const autoKey = `${driver.id}-${date}`;
        if (stops.length > 0 && !autoSavedRef.has(autoKey)) {
          autoSavedRef.add(autoKey);
          boardsToAutoSave.push({
            id: generateId(),
            driverId: driver.id,
            date,
            items: stops.map((s) => `${s.carCount}-${s.pickupLocation}`),
            stops,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      const totals = getBoardTotals(stops, driver.payRatePerCar);

      // Carryover display (separate from the auto-saved stops above)
      const prevBoard = boards.find((e) => e.driverId === driver.id && e.date === prevDate);
      const prevStops = normalizeBoardStops(prevBoard);
      const carriedOver: CarriedOverStop[] = prevStops
        .filter((s) => s.status === "overnight")
        .map((s) => ({
          carCount: s.carCount,
          pickupLocation: "SHOP",
          dropoffLocation: s.dropoffLocation || "",
          fromDate: prevDate,
        }));

      return { id: driver.id, driver, board, stops, carriedOver, fromPlanning, ...totals };
    });

    // Batch auto-save outside render
    if (boardsToAutoSave.length > 0) {
      setTimeout(() => {
        const current = getDriverBoards();
        const newBoards = boardsToAutoSave.filter(
          (b) => !current.some((c) => c.driverId === b.driverId && c.date === b.date),
        );
        if (newBoards.length > 0) {
          saveDriverBoards([...current, ...newBoards]);
        }
      }, 0);
    }

    return rows;
  }, [boards, planningSlots, date, prevDate, activeDrivers]);

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

  const handleCreateAddress = (rawValue: string): string => {
    const value = rawValue.trim();
    if (!value) return value;
    const existing = addresses.find((a) => a.name.toUpperCase() === value.toUpperCase());
    if (existing) return existing.name;
    const next: Address = { id: generateId(), name: value, line1: "", city: "", state: "", zip: "" };
    saveAddresses([...addresses, next]);
    toast("Address added", { description: `${next.name} added.` });
    return next.name;
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
                addressOptions={addressOptions}
                onCreateLocation={handleCreateLocation}
                onCreateAddress={handleCreateAddress}
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
  addressOptions,
  onCreateLocation,
  onCreateAddress,
  onSave,
}: {
  row: DriverSheetRow;
  locationOptions: LocationProfile[];
  addressOptions: Address[];
  onCreateLocation: (value: string) => string;
  onCreateAddress: (value: string) => string;
  onSave: (driverId: string, stops: DriverBoardStop[]) => void;
}) {
  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);
  const [stops, setStops] = useState<DriverBoardStop[]>([]);

  useEffect(() => {
    setStops(row.stops.length > 0 ? row.stops : []);
  }, [row.stops]);

  const updateStop = (index: number, patch: Partial<DriverBoardStop>) => {
    const updated = stops.map((stop, i) => i === index ? { ...stop, ...patch } : stop);
    setStops(updated);
    onSave(row.id, updated); // auto-save on every change
  };

  const addStop = () => {
    const updated = [...stops, createEmptyStop()];
    setStops(updated);
    setEditingStopIndex(updated.length - 1); // open the new stop for editing
  };

  const removeStop = (index: number) => {
    const updated = stops.filter((_, i) => i !== index);
    setStops(updated);
    setEditingStopIndex(null);
    onSave(row.id, updated);
  };

  const payRate = row.driver.payRatePerCar;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{row.driver.name}</CardTitle>
                {row.fromPlanning && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">From Plan</Badge>
                )}
              </div>
              <CardDescription className="mt-0.5">
                {row.totalCars} cars
                {row.completedCars > 0 && ` · ${row.completedCars} completed`}
                {row.heldCars > 0 && ` · ${row.heldCars} split`}
                {row.fromPlanning && " · edit & save to confirm"}
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
          {/* Carried-over overnight loads from previous day */}
          {row.carriedOver.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 space-y-1">
              <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">From yesterday — held overnight</p>
              {row.carriedOver.map((co, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-amber-900">
                    {co.carCount} car{co.carCount === 1 ? "" : "s"} at SHOP → {co.dropoffLocation || "TBD"}
                  </span>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">Carryover</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Clickable stop rows */}
          <div className="space-y-1.5">
            {stops.length > 0 ? stops.map((stop, index) => {
              const stopPay = getStopPay(stop, payRate);
              return (
                <div
                  key={stop.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setEditingStopIndex(index)}
                >
                  <span className="tabular-nums font-bold text-sm w-6 text-center">{stop.carCount}</span>
                  <div className="flex-1 min-w-0 text-sm">
                    <span>{stop.pickupLocation || "?"}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span>{stop.dropoffLocation || "?"}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] shrink-0 ${
                      stop.status === "completed" ? "bg-emerald-100 text-emerald-700"
                      : stop.status === "split" ? "bg-purple-100 text-purple-700"
                      : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {stop.status === "completed" ? "Done" : stop.status === "split" ? "Split" : "O/N"}
                  </Badge>
                  {stopPay !== null && (
                    <span className="tabular-nums text-xs font-medium text-emerald-700 shrink-0">
                      ${stopPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              );
            }) : (
              <p className="text-sm text-muted-foreground text-center py-4">No loads entered.</p>
            )}
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={addStop}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Load
          </Button>
        </CardContent>
      </Card>

      {/* Individual stop edit dialog */}
      <Dialog open={editingStopIndex !== null} onOpenChange={(o) => !o && setEditingStopIndex(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {row.driver.name} — Load {editingStopIndex !== null ? editingStopIndex + 1 : ""}
              {payRate !== undefined && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  Default: ${payRate}/car
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {editingStopIndex !== null && stops[editingStopIndex] && (() => {
            const stop = stops[editingStopIndex];
            const index = editingStopIndex;
            const stopPay = getStopPay(stop, payRate);
            return (
              <div className="space-y-4">
                {stopPay !== null && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800 text-center">
                    ${stopPay.toLocaleString("en-US", { minimumFractionDigits: 2 })} — {stop.carCount} cars × ${stop.payRatePerCar ?? payRate ?? 0}/car
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cars">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={String(stop.carCount)}
                      onChange={(e) => updateStop(index, { carCount: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                      autoFocus
                    />
                  </Field>

                  <Field label={`Pay Rate ($/car)`}>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stop.payRatePerCar !== undefined ? String(stop.payRatePerCar) : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateStop(index, { payRatePerCar: val === "" ? undefined : Number(val) });
                      }}
                      placeholder={payRate !== undefined ? `${payRate} (default)` : "Rate"}
                    />
                  </Field>

                  <Field label="Pickup Address">
                    <SearchableAddressSelect
                      value={stop.pickupLocation}
                      options={addressOptions}
                      placeholder="Where picked up"
                      onCreate={onCreateAddress}
                      onValueChange={(v) => updateStop(index, { pickupLocation: v })}
                    />
                  </Field>

                  <Field label="Destination Address">
                    <SearchableAddressSelect
                      value={stop.dropoffLocation}
                      options={addressOptions}
                      placeholder="Final destination"
                      onCreate={onCreateAddress}
                      onValueChange={(v) => updateStop(index, { dropoffLocation: v })}
                    />
                  </Field>

                  <Field label="Status">
                    <Select
                      value={stop.status}
                      onValueChange={(v) => {
                        const patch: Partial<DriverBoardStop> = { status: v as DriverBoardStop["status"] };
                        if (v === "overnight") patch.overnightLocation = "SHOP";
                        if (v === "split") patch.overnightLocation = patch.overnightLocation || "SHOP";
                        updateStop(index, patch);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="overnight">Overnight — held at shop</SelectItem>
                        <SelectItem value="split">Split — different driver delivers</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {stop.status === "split" && (
                    <Field label="This driver's leg">
                      <Select
                        value={stop.splitLeg || "pickup"}
                        onValueChange={(v) => updateStop(index, { splitLeg: v as "pickup" | "delivery" })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pickup">Pickup leg</SelectItem>
                          <SelectItem value="delivery">Delivery leg</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  <div className="sm:col-span-2">
                    <Field label="Notes">
                      <Textarea
                        value={stop.notes || ""}
                        onChange={(e) => updateStop(index, { notes: e.target.value })}
                        rows={2}
                      />
                    </Field>
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t">
                  <Button variant="destructive" size="sm" onClick={() => removeStop(index)}>
                    Remove Load
                  </Button>
                  <Button onClick={() => setEditingStopIndex(null)}>Done</Button>
                </div>
              </div>
            );
          })()}
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
        : (stop.status !== "completed"
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

function SearchableAddressSelect({
  value, options, placeholder, onCreate, onValueChange,
}: {
  value: string;
  options: Address[];
  placeholder: string;
  onCreate: (value: string) => string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = options.filter((a) =>
    !query || a.name.toUpperCase().includes(query.toUpperCase()) || a.city.toUpperCase().includes(query.toUpperCase()),
  ).slice(0, 20);
  const canCreate = query.trim().length > 0 && !options.some((a) => a.name.toUpperCase() === query.trim().toUpperCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal text-sm">
          {value ? <span>{value}</span> : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search addresses..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandGroup>
              {filtered.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.name} ${a.city} ${a.line1}`}
                  onSelect={() => { onValueChange(a.name); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === a.name ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="text-sm">{a.name}</span>
                    {a.city && <span className="text-xs text-muted-foreground">{a.city}, {a.state}</span>}
                  </div>
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem
                  value={`create:${query}`}
                  onSelect={() => {
                    const name = onCreate(query);
                    if (name) onValueChange(name);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm">Add "{query.trim()}"</span>
                    <span className="text-xs text-muted-foreground">Create new address</span>
                  </div>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandEmpty>No address found.</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
