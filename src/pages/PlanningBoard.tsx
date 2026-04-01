import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useStoreData } from "@/hooks/use-store";
import {
  generateId, getDrivers, getDriverBoards, getLocations, getAddresses, getPlanningSlots, savePlanningSlots,
  getLoads, saveLoads, getCars, saveCars, saveLocations, saveAddresses,
} from "@/lib/store";
import { normalizeBoardStops } from "@/lib/driver-recap";
import { Address, Car, Driver, Load, LocationProfile, PlanningSlot } from "@/lib/types";
import { decodeVin } from "@/lib/vin";
import {
  AlertCircle, Check, ChevronLeft, ChevronRight, Copy,
  Download, Plus, Trash2, UserPlus, X, Rocket,
} from "lucide-react";
import { addDays, format, subDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingVin = { tempId: string; vin: string; year: string; make: string; model: string; decoded: boolean };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanningBoardPage() {
  const drivers = useStoreData(getDrivers);
  const allSlots = useStoreData(getPlanningSlots);
  const boards = useStoreData(getDriverBoards);
  const locations = useStoreData(getLocations);
  const addresses = useStoreData(getAddresses);
  const [dayOffset, setDayOffset] = useState(0);
  const [editingSlot, setEditingSlot] = useState<PlanningSlot | null>(null);
  const [assigningSlot, setAssigningSlot] = useState<PlanningSlot | null>(null);
  const [finalizeDate, setFinalizeDate] = useState<string | null>(null);
  const [finalizeSlot, setFinalizeSlot] = useState<PlanningSlot | null>(null);

  const customerOptions = useMemo(
    () => locations.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [locations],
  );

  const addressOptions = useMemo(
    () => addresses.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [addresses],
  );

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

  const activeDrivers = useMemo(() => drivers.filter((d) => d.status === "active"), [drivers]);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const startDate = addDays(today, dayOffset);
  const days = Array.from({ length: 3 }, (_, i) => {
    const d = addDays(startDate, i);
    return {
      date: format(d, "yyyy-MM-dd"),
      label: format(d, "EEE"),
      full: format(d, "MMM d"),
      isToday: format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"),
    };
  });

  // Carryover from previous day's driver boards (overnight + split)
  const carryoverSlots = useMemo(() => {
    const result: Array<{ date: string; driverId?: string; summary: string; pickup: string; delivery: string; carCount: number; isOvernight: boolean }> = [];

    for (const day of days) {
      const prevDate = format(subDays(new Date(`${day.date}T12:00:00`), 1), "yyyy-MM-dd");
      // Check if we already have carryover slots created for this day
      const existingCarryovers = allSlots.filter((s) => s.date === day.date && s.notes?.startsWith("[Carryover"));
      if (existingCarryovers.length > 0) continue;

      for (const driver of activeDrivers) {
        const board = boards.find((b) => b.driverId === driver.id && b.date === prevDate);
        const stops = normalizeBoardStops(board);
        for (const stop of stops) {
          if (stop.status === "overnight") {
            result.push({
              date: day.date,
              driverId: driver.id, // same driver
              summary: `${stop.carCount} cars SHOP → ${stop.dropoffLocation || "TBD"}`,
              pickup: "SHOP",
              delivery: stop.dropoffLocation || "",
              carCount: stop.carCount,
              isOvernight: true,
            });
          } else if (stop.status === "split") {
            result.push({
              date: day.date,
              driverId: undefined, // goes to unassigned pool
              summary: `${stop.carCount} cars SHOP → ${stop.dropoffLocation || "TBD"} (split)`,
              pickup: "SHOP",
              delivery: stop.dropoffLocation || "",
              carCount: stop.carCount,
              isOvernight: false,
            });
          }
        }
      }
    }
    return result;
  }, [days, boards, activeDrivers, allSlots]);

  // Auto-create carryover slots if they don't exist
  if (carryoverSlots.length > 0) {
    const newSlots = carryoverSlots.map((co) => ({
      id: generateId(),
      date: co.date,
      driverId: co.driverId,
      loadSummary: co.summary,
      pickupLocation: co.pickup,
      deliveryLocation: co.delivery,
      carCount: co.carCount,
      confirmed: false,
      notes: `[Carryover] ${co.isOvernight ? "Overnight" : "Split"} from previous day`,
    }));
    savePlanningSlots([...allSlots, ...newSlots]);
  }

  // Slots per day
  const dayData = useMemo(() => days.map((day) => {
    const daySlots = allSlots.filter((s) => s.date === day.date);
    const unassigned = daySlots.filter((s) => !s.driverId);
    const driverRows = activeDrivers.map((driver) => ({
      driver,
      slots: daySlots.filter((s) => s.driverId === driver.id),
    }));
    const emptyDrivers = driverRows.filter((r) => r.slots.length === 0);
    return { ...day, daySlots, unassigned, driverRows, emptyDrivers };
  }), [days, allSlots, activeDrivers]);

  // ─── Slot CRUD ──────────────────────────────────────────────────────────────

  const saveSlot = (slot: PlanningSlot) => {
    if (slot.id) {
      savePlanningSlots(allSlots.map((s) => (s.id === slot.id ? slot : s)));
    } else {
      savePlanningSlots([...allSlots, { ...slot, id: generateId() }]);
    }
    setEditingSlot(null);
  };

  const deleteSlot = (id: string) => {
    savePlanningSlots(allSlots.filter((s) => s.id !== id));
    setEditingSlot(null);
  };

  const assignDriver = (slotId: string, driverId: string) => {
    savePlanningSlots(allSlots.map((s) => (s.id === slotId ? { ...s, driverId } : s)));
    setAssigningSlot(null);
    toast("Driver assigned");
  };

  const unassignDriver = (slotId: string) => {
    savePlanningSlots(allSlots.map((s) => (s.id === slotId ? { ...s, driverId: undefined } : s)));
  };

  // ─── Export / Copy ──────────────────────────────────────────────────────────

  const handleCopyDay = (date: string) => {
    const dayLabel = format(new Date(`${date}T12:00:00`), "EEE M/d");
    const daySlots = allSlots.filter((s) => s.date === date);
    const lines = [`Plan for ${dayLabel}:`, ""];
    for (const driver of activeDrivers) {
      const driverSlots = daySlots.filter((s) => s.driverId === driver.id);
      if (driverSlots.length === 0) {
        lines.push(`${driver.name}: OPEN — needs work`);
      } else {
        for (const sl of driverSlots) {
          const route = [sl.pickupLocation, sl.deliveryLocation].filter(Boolean).join(" → ");
          lines.push(`${driver.name}: ${sl.loadSummary}${route ? ` (${route})` : ""}${sl.carCount ? ` — ${sl.carCount} cars` : ""}`);
        }
      }
    }
    const unassigned = daySlots.filter((s) => !s.driverId);
    if (unassigned.length > 0) {
      lines.push("", "UNASSIGNED:");
      for (const sl of unassigned) lines.push(`  ${sl.loadSummary}${sl.pickupLocation ? ` (${sl.pickupLocation})` : ""}`);
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast("Copied to clipboard", { description: `${dayLabel} plan copied.` });
  };

  const handleExportDay = (date: string) => {
    const dayLabel = format(new Date(`${date}T12:00:00`), "EEEE, MMMM d, yyyy");
    const daySlots = allSlots.filter((s) => s.date === date);
    const lines = ["MONROE AUTO TRANSPORT", `DAILY PLAN — ${dayLabel}`, "─".repeat(50), ""];
    for (const driver of activeDrivers) {
      const driverSlots = daySlots.filter((s) => s.driverId === driver.id);
      if (driverSlots.length === 0) {
        lines.push(`${driver.name}: OPEN`);
      } else {
        lines.push(`${driver.name}:`);
        for (const sl of driverSlots) {
          const route = [sl.pickupLocation, sl.deliveryLocation].filter(Boolean).join(" → ");
          const conf = sl.confirmed ? "[CONFIRMED]" : "[PLAN]";
          lines.push(`  ${conf} ${sl.loadSummary}${route ? ` — ${route}` : ""}${sl.carCount ? ` (${sl.carCount} cars)` : ""}`);
          if (sl.notes) lines.push(`    ${sl.notes}`);
        }
      }
      lines.push("");
    }
    const unassigned = daySlots.filter((s) => !s.driverId);
    if (unassigned.length > 0) {
      lines.push("NEEDS DRIVER:", ...unassigned.map((sl) => `  ${sl.loadSummary}${sl.pickupLocation ? ` — from ${sl.pickupLocation}` : ""}`), "");
    }
    lines.push("─".repeat(50), `Generated: ${new Date().toLocaleString()}`);
    downloadText(lines.join("\n"), `plan-${date}.txt`);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planning Board</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign loads to drivers — finalize when ready to create formal loads
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => setEditingSlot({ id: "", date: days[0].date, loadSummary: "", confirmed: false })}>
            <Plus className="h-4 w-4 mr-1" /> Add Work
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setDayOffset((o) => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              {days[0].full} – {days[2].full}
            </span>
            <Button variant="outline" size="icon" onClick={() => setDayOffset((o) => o + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {dayOffset !== 0 && <Button variant="ghost" size="sm" onClick={() => setDayOffset(0)}>Today</Button>}
          </div>
        </div>
      </div>

      {/* 3-day vertical stack */}
      <div className="space-y-8">
        {dayData.map((day) => (
          <div key={day.date} className="space-y-3">
            {/* Day header card */}
            <Card className={day.isToday ? "border-primary" : ""}>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {day.label} {day.full}
                      {day.isToday && <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary text-xs">Today</Badge>}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {day.daySlots.length} loads · {day.emptyDrivers.length > 0 && (
                        <span className="text-amber-600">{day.emptyDrivers.length} driver{day.emptyDrivers.length === 1 ? "" : "s"} open</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyDay(day.date)} title="Copy plan">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExportDay(day.date)} title="Export plan">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Unassigned work pool */}
            {day.unassigned.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Needs Driver ({day.unassigned.length})</span>
                </div>
                <CardContent className="p-2 space-y-1.5">
                  {day.unassigned.map((slot) => (
                    <div key={slot.id} className="rounded-lg border border-amber-200 bg-white p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{slot.loadSummary || "No description"}</p>
                          {(slot.pickupLocation || slot.deliveryLocation) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {[slot.pickupLocation, slot.deliveryLocation].filter(Boolean).join(" → ")}
                            </p>
                          )}
                          {slot.carCount !== undefined && slot.carCount > 0 && (
                            <p className="text-xs text-muted-foreground">{slot.carCount} cars</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAssigningSlot(slot)}>
                            <UserPlus className="h-3 w-3 mr-1" /> Assign
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSlot(slot)}>
                            <span className="text-xs">...</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Driver cards — grid layout */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {day.driverRows.map((row) => {
              const driverCarTotal = row.slots.reduce((s, sl) => s + (sl.carCount || 0), 0);
              return (
                <Card key={row.driver.id} className={`overflow-hidden ${row.slots.length === 0 ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{row.driver.name}</span>
                      {row.slots.length === 0 ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">Open</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">{driverCarTotal} cars</Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingSlot({
                      id: "", date: day.date, driverId: row.driver.id, loadSummary: "", confirmed: false,
                    })}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CardContent className="p-2 space-y-1.5">
                    {/* Assigned loads */}
                    {row.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`rounded-lg border p-2.5 cursor-pointer transition-colors hover:bg-muted/40 ${
                          slot.confirmed ? "border-emerald-200 bg-emerald-50/30" : "border-dashed"
                        }`}
                        onClick={() => setEditingSlot(slot)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium leading-tight">{slot.loadSummary || "No description"}</p>
                              {slot.carCount !== undefined && slot.carCount > 0 && (
                                <Badge variant="outline" className="text-[10px] shrink-0">{slot.carCount}</Badge>
                              )}
                            </div>
                            {(slot.pickupLocation || slot.deliveryLocation) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {[slot.pickupLocation, slot.deliveryLocation].filter(Boolean).join(" → ")}
                              </p>
                            )}
                          </div>
                          {slot.confirmed ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px] shrink-0">
                              <Check className="h-2.5 w-2.5 mr-0.5" /> Set
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-500 text-[10px] shrink-0">Plan</Badge>
                          )}
                        </div>
                        {slot.notes && <p className="text-xs text-muted-foreground mt-1 italic">{slot.notes}</p>}
                      </div>
                    ))}

                    {/* Quick-assign from unassigned pool */}
                    {day.unassigned.length > 0 && (
                      <div className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02]">
                        <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-primary/60">
                          Assign load ({day.unassigned.length} available)
                        </p>
                        <div className="px-2 pb-2 space-y-1">
                          {day.unassigned.map((slot) => (
                            <button
                              key={slot.id}
                              type="button"
                              className="w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-primary/5 transition-colors group"
                              onClick={() => assignDriver(slot.id, row.driver.id)}
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-foreground">
                                  {[slot.pickupLocation, slot.deliveryLocation].filter(Boolean).join(" → ") || slot.loadSummary}
                                </span>
                              </div>
                              {slot.carCount !== undefined && slot.carCount > 0 && (
                                <Badge variant="outline" className="text-[10px] shrink-0">{slot.carCount}</Badge>
                              )}
                              <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                Assign →
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {row.slots.length === 0 && day.unassigned.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        No work — add a load or check nearby routes
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            </div>

            {/* Spacer — Add Work is at the top of the page now */}

            {/* Finalize day button */}
            {day.daySlots.some((s) => s.driverId && !s.confirmed) && (
              <Button
                variant="default" size="sm" className="w-full"
                onClick={() => setFinalizeDate(day.date)}
              >
                <Rocket className="h-3.5 w-3.5 mr-1" /> Finalize Day's Loads
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* ─── Assign Driver Dialog ────────────────────────────────────────── */}
      <Dialog open={!!assigningSlot} onOpenChange={(o) => !o && setAssigningSlot(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Driver</DialogTitle></DialogHeader>
          {assigningSlot && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{assigningSlot.loadSummary}</p>
                {assigningSlot.pickupLocation && (
                  <p className="text-muted-foreground mt-0.5">{assigningSlot.pickupLocation} → {assigningSlot.deliveryLocation || "?"}</p>
                )}
              </div>
              <div className="space-y-1.5">
                {activeDrivers.map((driver) => {
                  const driverBusy = allSlots.some((s) => s.driverId === driver.id && s.date === assigningSlot.date);
                  return (
                    <Button
                      key={driver.id}
                      variant="outline"
                      className={`w-full justify-start ${driverBusy ? "opacity-50" : ""}`}
                      onClick={() => assignDriver(assigningSlot.id, driver.id)}
                    >
                      <span className="flex-1 text-left">{driver.name}</span>
                      {driverBusy && <span className="text-xs text-muted-foreground">has work</span>}
                      {!driverBusy && <span className="text-xs text-emerald-600">available</span>}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Edit Slot Dialog ────────────────────────────────────────────── */}
      <SlotDialog
        slot={editingSlot}
        drivers={activeDrivers}
        allSlots={allSlots}
        customerOptions={customerOptions}
        addressOptions={addressOptions}
        onCreateLocation={handleCreateLocation}
        onCreateAddress={handleCreateAddress}
        onSave={saveSlot}
        onDelete={deleteSlot}
        onUnassign={(id) => { unassignDriver(id); setEditingSlot(null); }}
        onClose={() => setEditingSlot(null)}
      />

      {/* ─── Finalize Day Dialog ─────────────────────────────────────────── */}
      {finalizeDate && (
        <FinalizeDayDialog
          date={finalizeDate}
          slots={allSlots.filter((s) => s.date === finalizeDate && s.driverId && !s.confirmed)}
          drivers={activeDrivers}
          onFinalize={(slotId) => {
            setFinalizeDate(null);
            setFinalizeSlot(allSlots.find((s) => s.id === slotId) || null);
          }}
          onClose={() => setFinalizeDate(null)}
        />
      )}

      {/* ─── VIN Entry for Finalized Load ────────────────────────────────── */}
      {finalizeSlot && (
        <FinalizeVinDialog
          slot={finalizeSlot}
          driver={activeDrivers.find((d) => d.id === finalizeSlot.driverId)}
          onComplete={(loadId) => {
            // Mark slot as confirmed
            savePlanningSlots(allSlots.map((s) => (s.id === finalizeSlot.id ? { ...s, confirmed: true } : s)));
            setFinalizeSlot(null);
            toast("Load created", { description: `Load finalized and cars added to inventory.` });
          }}
          onClose={() => setFinalizeSlot(null)}
        />
      )}
    </div>
  );
}

// ─── Slot Edit Dialog ─────────────────────────────────────────────────────────

function SlotDialog({
  slot, drivers, allSlots, customerOptions, addressOptions, onCreateLocation, onCreateAddress, onSave, onDelete, onUnassign, onClose,
}: {
  slot: PlanningSlot | null;
  drivers: Driver[];
  allSlots: PlanningSlot[];
  customerOptions: LocationProfile[];
  addressOptions: Address[];
  onCreateLocation: (value: string) => string;
  onCreateAddress: (value: string) => string;
  onSave: (slot: PlanningSlot) => void;
  onDelete: (id: string) => void;
  onUnassign: (id: string) => void;
  onClose: () => void;
}) {
  const [customer, setCustomer] = useState("");
  const [pickup, setPickup] = useState("");
  const [delivery, setDelivery] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [pickupSearch, setPickupSearch] = useState("");
  const [deliverySearch, setDeliverySearch] = useState("");

  // Sync state when slot changes
  const slotId = slot?.id;
  if (slot && pickup !== (slot.pickupLocation || "") && slotId !== undefined) {
    // handled by explicit reset below
  }

  // Reset on new slot
  const isOpen = !!slot;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!slot) return;
    const fd = new FormData(e.currentTarget);
    const count = Number(fd.get("carCount")) || 0;
    const custName = customerOptions.find((l) => l.code === customer)?.name || customer;
    const summary = [count ? `${count} cars` : "", custName, pickup, delivery].filter(Boolean).join(" → ") || "New load";
    onSave({
      ...slot,
      date: fd.get("date") as string || slot.date,
      driverId: (fd.get("driverId") as string) || slot.driverId || undefined,
      customer: customer || undefined,
      loadSummary: summary,
      pickupLocation: pickup || undefined,
      deliveryLocation: delivery || undefined,
      carCount: count || undefined,
      notes: fd.get("notes") as string || undefined,
    });
  };

  // Reset fields when dialog opens with a new slot
  useState(() => {
    if (slot) {
      setCustomer(slot.customer || "");
      setPickup(slot.pickupLocation || "");
      setDelivery(slot.deliveryLocation || "");
    }
  });

  if (slot && customer === "" && slot.customer) setCustomer(slot.customer);
  if (slot && pickup === "" && slot.pickupLocation) setPickup(slot.pickupLocation);
  if (slot && delivery === "" && slot.deliveryLocation) setDelivery(slot.deliveryLocation);

  const filteredCustomers = (q: string) =>
    customerOptions.filter((l) =>
      !q || l.name.toUpperCase().includes(q.toUpperCase()) || l.code.includes(q.toUpperCase()),
    ).slice(0, 20);
  const canCreateCustomer = customerSearch.trim().length > 0 && !customerOptions.some((l) =>
    l.name.toUpperCase() === customerSearch.trim().toUpperCase() || l.code === customerSearch.trim().toUpperCase(),
  );
  const selectedCustomer = customerOptions.find((l) => l.code === customer);

  const filteredAddresses = (search: string) =>
    addressOptions.filter((a) =>
      !search || a.name.toUpperCase().includes(search.toUpperCase()) || a.city.toUpperCase().includes(search.toUpperCase()),
    ).slice(0, 20);

  const canCreatePickup = pickupSearch.trim().length > 0 && !addressOptions.some((a) => a.name.toUpperCase() === pickupSearch.trim().toUpperCase());
  const canCreateDelivery = deliverySearch.trim().length > 0 && !addressOptions.some((a) => a.name.toUpperCase() === deliverySearch.trim().toUpperCase());

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) { onClose(); setPickup(""); setDelivery(""); setPickupSearch(""); setDeliverySearch(""); }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{slot?.id ? "Edit Work" : "Add Work"}</DialogTitle></DialogHeader>
        {slot && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Customer */}
              <div className="sm:col-span-2">
                <Label>Customer</Label>
                <div className="relative">
                  <Input
                    value={customerSearch || (selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.code})` : customer)}
                    onChange={(e) => { setCustomerSearch(e.target.value); if (!e.target.value) setCustomer(""); }}
                    onFocus={() => setCustomerSearch(selectedCustomer?.name || customer)}
                    onBlur={() => setTimeout(() => setCustomerSearch(""), 150)}
                    placeholder="Search customer by name..."
                    autoFocus
                  />
                  {customerSearch && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers(customerSearch).map((l) => (
                        <button key={l.id} type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${customer === l.code ? "bg-muted" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); setCustomer(l.code); setCustomerSearch(""); }}>
                          <span className="font-medium">{l.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs font-mono">{l.code}</span>
                        </button>
                      ))}
                      {canCreateCustomer && (
                        <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 text-primary"
                          onMouseDown={(e) => { e.preventDefault(); const c = onCreateLocation(customerSearch); if (c) setCustomer(c); setCustomerSearch(""); }}>
                          <Plus className="inline h-3 w-3 mr-1" />Add "{customerSearch.trim()}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Cars</Label>
                <Input name="carCount" type="number" min="0" defaultValue={slot.carCount || ""} placeholder="How many?" />
              </div>
              <div>
                <Label>Day</Label>
                <Input name="date" type="date" defaultValue={slot.date} required />
              </div>

              {/* Pickup address */}
              <div>
                <Label>Pickup Address</Label>
                <div className="relative">
                  <Input
                    value={pickupSearch || pickup}
                    onChange={(e) => { setPickupSearch(e.target.value); if (!e.target.value) setPickup(""); }}
                    onFocus={() => setPickupSearch(pickup)}
                    onBlur={() => setTimeout(() => setPickupSearch(""), 150)}
                    placeholder="Search address..."
                  />
                  {pickupSearch && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                      {filteredAddresses(pickupSearch).map((a) => (
                        <button key={a.id} type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${pickup === a.name ? "bg-muted" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); setPickup(a.name); setPickupSearch(""); }}>
                          <span className="font-medium">{a.name}</span>
                          {a.city && <span className="text-muted-foreground ml-2 text-xs">{a.city}, {a.state}</span>}
                        </button>
                      ))}
                      {canCreatePickup && (
                        <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 text-primary"
                          onMouseDown={(e) => { e.preventDefault(); const n = onCreateAddress(pickupSearch); if (n) setPickup(n); setPickupSearch(""); }}>
                          <Plus className="inline h-3 w-3 mr-1" />Add "{pickupSearch.trim()}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery address */}
              <div>
                <Label>Delivery Address</Label>
                <div className="relative">
                  <Input
                    value={deliverySearch || delivery}
                    onChange={(e) => { setDeliverySearch(e.target.value); if (!e.target.value) setDelivery(""); }}
                    onFocus={() => setDeliverySearch(delivery)}
                    onBlur={() => setTimeout(() => setDeliverySearch(""), 150)}
                    placeholder="Search address..."
                  />
                  {deliverySearch && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                      {filteredAddresses(deliverySearch).map((a) => (
                        <button key={a.id} type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${delivery === a.name ? "bg-muted" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); setDelivery(a.name); setDeliverySearch(""); }}>
                          <span className="font-medium">{a.name}</span>
                          {a.city && <span className="text-muted-foreground ml-2 text-xs">{a.city}, {a.state}</span>}
                        </button>
                      ))}
                      {canCreateDelivery && (
                        <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 text-primary"
                          onMouseDown={(e) => { e.preventDefault(); const n = onCreateAddress(deliverySearch); if (n) setDelivery(n); setDeliverySearch(""); }}>
                          <Plus className="inline h-3 w-3 mr-1" />Add "{deliverySearch.trim()}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Driver</Label>
                <select
                  name="driverId"
                  defaultValue={slot.driverId || ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea name="notes" defaultValue={slot.notes || ""} rows={2} placeholder="Route notes, special instructions..." />
              </div>
            </div>
            <div className="flex justify-between gap-3">
              <div className="flex gap-2">
                {slot.id && (
                  <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(slot.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                )}
                {slot.id && slot.driverId && (
                  <Button type="button" variant="outline" size="sm" onClick={() => onUnassign(slot.id)}>
                    Move to Unassigned
                  </Button>
                )}
              </div>
              <Button type="submit">{slot.id ? "Save" : "Add Work"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Finalize Day Dialog ──────────────────────────────────────────────────────

function FinalizeDayDialog({
  date, slots, drivers, onFinalize, onClose,
}: {
  date: string;
  slots: PlanningSlot[];
  drivers: Driver[];
  onFinalize: (slotId: string) => void;
  onClose: () => void;
}) {
  const dayLabel = format(new Date(`${date}T12:00:00`), "EEE, MMM d");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Finalize Loads — {dayLabel}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Pick a load to finalize. You'll add the VINs, and it'll create a formal load in the system.</p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {slots.map((slot) => {
            const driver = drivers.find((d) => d.id === slot.driverId);
            return (
              <div
                key={slot.id}
                className="rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => onFinalize(slot.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{slot.loadSummary}</p>
                    <p className="text-xs text-muted-foreground">
                      {driver?.name} · {[slot.pickupLocation, slot.deliveryLocation].filter(Boolean).join(" → ")}
                      {slot.carCount ? ` · ~${slot.carCount} cars` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Rocket className="h-3 w-3 mr-1" /> Finalize
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── VIN Entry Dialog (creates Load + Cars) ───────────────────────────────────

function FinalizeVinDialog({
  slot, driver, onComplete, onClose,
}: {
  slot: PlanningSlot;
  driver?: Driver;
  onComplete: (loadId: string) => void;
  onClose: () => void;
}) {
  const [vins, setVins] = useState<PendingVin[]>([]);
  const [vinInput, setVinInput] = useState("");
  const [decoding, setDecoding] = useState(false);
  const [customer, setCustomer] = useState("");
  const [price, setPrice] = useState("");

  // Parse multiple VINs from input (handles paste of newline/comma/space separated lists)
  const parseVins = (raw: string): string[] => {
    return raw
      .split(/[\n,\t\r]+/)
      .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
      .filter((s) => s.length >= 5) // VINs are 17 chars but allow partials
      .filter((s, i, arr) => arr.indexOf(s) === i); // dedupe
  };

  const handleAddVins = async (raw: string) => {
    const vinList = parseVins(raw);
    if (vinList.length === 0) return;

    setDecoding(true);
    const existingVins = new Set(vins.map((v) => v.vin));
    const newEntries: PendingVin[] = [];

    for (const vin of vinList) {
      if (existingVins.has(vin)) continue;
      existingVins.add(vin);
      try {
        const decoded = await decodeVin(vin);
        newEntries.push({ tempId: generateId(), vin, year: String(decoded.year), make: decoded.make, model: decoded.model, decoded: true });
      } catch {
        newEntries.push({ tempId: generateId(), vin, year: "", make: "", model: "", decoded: false });
      }
    }

    setVins((prev) => [...prev, ...newEntries]);
    setVinInput("");
    setDecoding(false);
    if (newEntries.length > 0) {
      toast(`${newEntries.length} VIN${newEntries.length === 1 ? "" : "s"} added`);
    }
  };

  const handleFinalize = () => {
    const loads = getLoads();
    const existingCars = getCars();
    const newCars: Car[] = [];
    const carIds: string[] = [];

    // Generate load ID first so every car gets it
    const loadId = generateId();
    const refNumber = `LD-${new Date().getFullYear()}-${String(loads.length + 154).padStart(4, "0")}`;

    for (const pv of vins) {
      const existing = existingCars.find((c) => c.vin === pv.vin);
      if (existing) {
        carIds.push(existing.id);
        const idx = existingCars.findIndex((c) => c.id === existing.id);
        existingCars[idx] = {
          ...existing,
          status: "in_transit",
          loadId,
          pickupLocation: slot.pickupLocation,
          deliveryLocation: slot.deliveryLocation,
          driverId: slot.driverId,
          receivedDate: existing.receivedDate || slot.date,
        };
      } else {
        const carId = generateId();
        carIds.push(carId);
        newCars.push({
          id: carId,
          vin: pv.vin,
          year: Number(pv.year) || new Date().getFullYear(),
          make: pv.make || "Unknown",
          model: pv.model || "Unknown",
          vehicleName: `${pv.make} ${pv.model}`.trim() || "Unknown",
          status: "at_shop",
          loadId,
          receivedDate: slot.date,
          pickupLocation: slot.pickupLocation,
          deliveryLocation: slot.deliveryLocation,
          driverId: slot.driverId,
        });
      }
    }

    saveCars([...existingCars, ...newCars]);

    const vehicleInfo = vins.length > 0
      ? vins.map((v) => `${v.year} ${v.make} ${v.model}`.trim()).join(", ")
      : slot.carCount ? `~${slot.carCount} cars (VINs pending)` : "VINs pending";
    const newLoad: Load = {
      id: loadId,
      referenceNumber: refNumber,
      customer: customer || slot.loadSummary,
      customerPhone: "",
      pickupLocation: slot.pickupLocation || "",
      deliveryLocation: slot.deliveryLocation || "",
      pickupDate: slot.date,
      deliveryDate: "", // filled when marked delivered
      vehicleInfo,
      status: "booked",
      driverId: slot.driverId,
      price: Number(price) || 0,
      notes: vins.length === 0 ? `${slot.notes || ""} [VINs needed]`.trim() : (slot.notes || ""),
      carIds: carIds.length > 0 ? carIds : undefined,
    };
    saveLoads([...loads, newLoad]);
    onComplete(newLoad.id);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalize: {slot.loadSummary}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <p><span className="text-muted-foreground">Driver:</span> {driver?.name || "Unassigned"}</p>
          <p><span className="text-muted-foreground">Route:</span> {slot.pickupLocation || "?"} → {slot.deliveryLocation || "?"}</p>
          <p><span className="text-muted-foreground">Date:</span> {slot.date}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Customer / Account</Label><Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder={slot.loadSummary} /></div>
          <div><Label>Price ($)</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="0" /></div>
        </div>

        {/* VIN entry */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Add Cars by VIN <span className="font-normal text-muted-foreground">(optional — can add later)</span></Label>
            <div className="flex items-center gap-2">
              {vins.length > 0 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary">{vins.length} car{vins.length === 1 ? "" : "s"}</Badge>
              )}
              <span className="text-xs text-muted-foreground">Paste multiple VINs at once</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value.toUpperCase())}
              placeholder="Enter or paste VINs"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddVins(vinInput); } }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (pasted.includes("\n") || pasted.includes(",")) {
                  e.preventDefault();
                  handleAddVins(pasted);
                }
              }}
            />
            <Button type="button" variant="outline" onClick={() => handleAddVins(vinInput)} disabled={decoding || !vinInput.trim()}>
              {decoding ? "..." : "Add"}
            </Button>
          </div>

          {vins.length > 0 && (
            <div className="space-y-1.5">
              {vins.map((pv) => (
                <div key={pv.tempId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="font-mono text-xs flex-1">{pv.vin}</span>
                  {pv.decoded ? (
                    <span className="text-muted-foreground">{pv.year} {pv.make} {pv.model}</span>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input className="h-7 w-16 text-xs" placeholder="Year" value={pv.year}
                        onChange={(e) => setVins((prev) => prev.map((v) => v.tempId === pv.tempId ? { ...v, year: e.target.value } : v))} />
                      <Input className="h-7 w-20 text-xs" placeholder="Make" value={pv.make}
                        onChange={(e) => setVins((prev) => prev.map((v) => v.tempId === pv.tempId ? { ...v, make: e.target.value } : v))} />
                      <Input className="h-7 w-20 text-xs" placeholder="Model" value={pv.model}
                        onChange={(e) => setVins((prev) => prev.map((v) => v.tempId === pv.tempId ? { ...v, model: e.target.value } : v))} />
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                    onClick={() => setVins((prev) => prev.filter((v) => v.tempId !== pv.tempId))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{vins.length} car{vins.length === 1 ? "" : "s"} will be added to Cars dashboard</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleFinalize}>
            <Check className="h-4 w-4 mr-1" />
            {vins.length > 0
              ? `Create Load (${vins.length} car${vins.length === 1 ? "" : "s"})`
              : "Create Load — add VINs later"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
