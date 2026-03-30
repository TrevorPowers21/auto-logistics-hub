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
import { generateId, getDrivers, getPlanningSlots, savePlanningSlots } from "@/lib/store";
import { Driver, PlanningSlot } from "@/lib/types";
import { AlertCircle, ChevronLeft, ChevronRight, Copy, Download, Plus, Trash2 } from "lucide-react";
import { addDays, format } from "date-fns";

export default function PlanningBoardPage() {
  const drivers = useStoreData(getDrivers);
  const slots = useStoreData(getPlanningSlots);
  const [dayOffset, setDayOffset] = useState(0);
  const [editingSlot, setEditingSlot] = useState<PlanningSlot | null>(null);
  const [addDay, setAddDay] = useState<string | null>(null);

  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.status === "active"),
    [drivers],
  );

  // 3-day window starting from today + offset
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

  // Build grid: rows = drivers + unassigned, columns = days
  const grid = useMemo(() => {
    const driverRows = activeDrivers.map((driver) => ({
      driver,
      daySlots: days.map((day) =>
        slots.filter((s) => s.driverId === driver.id && s.date === day.date),
      ),
    }));

    // Unassigned slots (no driver)
    const unassignedSlots = days.map((day) =>
      slots.filter((s) => !s.driverId && s.date === day.date),
    );

    return { driverRows, unassignedSlots };
  }, [activeDrivers, days, slots]);

  // Stats
  const stats = useMemo(() => {
    const dayStats = days.map((day) => {
      const daySlots = slots.filter((s) => s.date === day.date);
      const assigned = daySlots.filter((s) => s.driverId);
      const unassigned = daySlots.filter((s) => !s.driverId);
      const totalCars = daySlots.reduce((s, sl) => s + (sl.carCount || 0), 0);
      return { assigned: assigned.length, unassigned: unassigned.length, totalCars };
    });
    return dayStats;
  }, [days, slots]);

  // Slot actions
  const handleAddSlot = (date: string, driverId?: string) => {
    setEditingSlot({
      id: "",
      date,
      driverId: driverId || undefined,
      loadSummary: "",
      confirmed: false,
    });
    setAddDay(date);
  };

  const handleSaveSlot = (slot: PlanningSlot) => {
    if (slot.id) {
      savePlanningSlots(slots.map((s) => (s.id === slot.id ? slot : s)));
    } else {
      savePlanningSlots([...slots, { ...slot, id: generateId() }]);
    }
    setEditingSlot(null);
    setAddDay(null);
  };

  const handleDeleteSlot = (id: string) => {
    savePlanningSlots(slots.filter((s) => s.id !== id));
    setEditingSlot(null);
  };

  const handleExportDay = (date: string) => {
    const dayLabel = format(new Date(`${date}T12:00:00`), "EEEE, MMMM d, yyyy");
    const daySlots = slots.filter((s) => s.date === date);
    const lines = [
      "MONROE AUTO TRANSPORT",
      `DAILY PLAN — ${dayLabel}`,
      "─".repeat(50),
      "",
    ];

    for (const driver of activeDrivers) {
      const driverSlots = daySlots.filter((s) => s.driverId === driver.id);
      if (driverSlots.length === 0) {
        lines.push(`${driver.name}: AVAILABLE`);
      } else {
        lines.push(`${driver.name}:`);
        for (const sl of driverSlots) {
          const cars = sl.carCount ? `${sl.carCount} cars` : "";
          const route = [sl.pickupLocation, sl.deliveryLocation].filter(Boolean).join(" → ");
          const conf = sl.confirmed ? "[CONFIRMED]" : "[TENTATIVE]";
          lines.push(`  ${conf} ${sl.loadSummary}${route ? ` — ${route}` : ""}${cars ? ` (${cars})` : ""}`);
          if (sl.notes) lines.push(`    Notes: ${sl.notes}`);
        }
      }
      lines.push("");
    }

    const unassigned = daySlots.filter((s) => !s.driverId);
    if (unassigned.length > 0) {
      lines.push("UNASSIGNED LOADS:");
      for (const sl of unassigned) {
        lines.push(`  ${sl.loadSummary}${sl.pickupLocation ? ` — ${sl.pickupLocation} → ${sl.deliveryLocation || "?"}` : ""}`);
      }
      lines.push("");
    }

    lines.push("─".repeat(50));
    lines.push(`Generated: ${new Date().toLocaleString()}`);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan-${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyDay = (date: string) => {
    const dayLabel = format(new Date(`${date}T12:00:00`), "EEE M/d");
    const daySlots = slots.filter((s) => s.date === date);
    const lines = [`Plan for ${dayLabel}:`, ""];
    for (const driver of activeDrivers) {
      const driverSlots = daySlots.filter((s) => s.driverId === driver.id);
      if (driverSlots.length === 0) {
        lines.push(`${driver.name}: open`);
      } else {
        for (const sl of driverSlots) {
          const route = [sl.pickupLocation, sl.deliveryLocation].filter(Boolean).join(" → ");
          lines.push(`${driver.name}: ${sl.loadSummary}${route ? ` (${route})` : ""}${sl.carCount ? ` — ${sl.carCount} cars` : ""}`);
        }
      }
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast("Copied to clipboard", { description: `${dayLabel} plan copied.` });
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planning Board</h1>
          <p className="text-muted-foreground text-sm mt-1">
            3-day load planning — assign loads to drivers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setDayOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {days[0].full} – {days[2].full}
          </span>
          <Button variant="outline" size="icon" onClick={() => setDayOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {dayOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setDayOffset(0)}>Today</Button>
          )}
        </div>
      </div>

      {/* Day columns */}
      <div className="grid gap-4 lg:grid-cols-3">
        {days.map((day, dayIndex) => (
          <div key={day.date} className="space-y-3">
            {/* Day header */}
            <Card className={day.isToday ? "border-primary" : ""}>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {day.label} {day.full}
                      {day.isToday && (
                        <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary text-xs">Today</Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats[dayIndex].assigned + stats[dayIndex].unassigned} loads · {stats[dayIndex].totalCars} cars
                      {stats[dayIndex].unassigned > 0 && (
                        <span className="text-amber-600 ml-1">· {stats[dayIndex].unassigned} unassigned</span>
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

            {/* Driver rows */}
            {grid.driverRows.map((row) => {
              const daySlots = row.daySlots[dayIndex];
              return (
                <Card key={row.driver.id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                    <span className="text-sm font-medium">{row.driver.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleAddSlot(day.date, row.driver.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CardContent className="p-2 space-y-1.5">
                    {daySlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Available</p>
                    ) : (
                      daySlots.map((slot) => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          onClick={() => setEditingSlot(slot)}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Unassigned */}
            {grid.unassignedSlots[dayIndex].length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Unassigned</span>
                </div>
                <CardContent className="p-2 space-y-1.5">
                  {grid.unassignedSlots[dayIndex].map((slot) => (
                    <SlotCard key={slot.id} slot={slot} onClick={() => setEditingSlot(slot)} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Add unassigned load */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => handleAddSlot(day.date)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Load
            </Button>
          </div>
        ))}
      </div>

      {/* Slot edit dialog */}
      <SlotDialog
        slot={editingSlot}
        drivers={activeDrivers}
        onSave={handleSaveSlot}
        onDelete={handleDeleteSlot}
        onClose={() => { setEditingSlot(null); setAddDay(null); }}
      />
    </div>
  );
}

// ─── Slot Card ────────────────────────────────────────────────────────────────

function SlotCard({ slot, onClick }: { slot: PlanningSlot; onClick: () => void }) {
  return (
    <div
      className={`rounded-lg border p-2.5 cursor-pointer transition-colors hover:bg-muted/40 ${
        !slot.confirmed ? "border-dashed border-muted-foreground/30" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{slot.loadSummary || "No description"}</p>
        <Badge
          variant="secondary"
          className={`shrink-0 text-[10px] ${
            slot.confirmed ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {slot.confirmed ? "Confirmed" : "Tentative"}
        </Badge>
      </div>
      {(slot.pickupLocation || slot.deliveryLocation) && (
        <p className="text-xs text-muted-foreground mt-1">
          {[slot.pickupLocation, slot.deliveryLocation].filter(Boolean).join(" → ")}
        </p>
      )}
      {slot.carCount !== undefined && slot.carCount > 0 && (
        <p className="text-xs text-muted-foreground">{slot.carCount} cars</p>
      )}
    </div>
  );
}

// ─── Slot Dialog ──────────────────────────────────────────────────────────────

function SlotDialog({
  slot,
  drivers,
  onSave,
  onDelete,
  onClose,
}: {
  slot: PlanningSlot | null;
  drivers: Driver[];
  onSave: (slot: PlanningSlot) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [driverId, setDriverId] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Reset when slot changes
  const isOpen = !!slot;
  if (slot && driverId !== (slot.driverId || "") && !isOpen) {
    // handled by useEffect below
  }

  // Sync local state when slot opens
  const slotId = slot?.id;
  useState(() => {
    if (slot) {
      setDriverId(slot.driverId || "");
      setConfirmed(slot.confirmed);
    }
  });

  // Keep in sync
  if (slot && slot.id !== slotId) {
    setDriverId(slot.driverId || "");
    setConfirmed(slot.confirmed);
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!slot) return;
    const fd = new FormData(e.currentTarget);
    onSave({
      ...slot,
      driverId: driverId || undefined,
      loadSummary: fd.get("loadSummary") as string,
      pickupLocation: fd.get("pickupLocation") as string || undefined,
      deliveryLocation: fd.get("deliveryLocation") as string || undefined,
      carCount: Number(fd.get("carCount")) || undefined,
      confirmed,
      notes: fd.get("notes") as string || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{slot?.id ? "Edit Load" : "Add Load"}</DialogTitle>
        </DialogHeader>
        {slot && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Load Description</Label>
                <Input name="loadSummary" defaultValue={slot.loadSummary} required placeholder="e.g. 9 cars NBG to Family" />
              </div>
              <div>
                <Label>Assign Driver</Label>
                <Select value={driverId} onValueChange={setDriverId}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Car Count</Label>
                <Input name="carCount" type="number" min="0" defaultValue={slot.carCount || ""} />
              </div>
              <div>
                <Label>Pickup Location</Label>
                <Input name="pickupLocation" defaultValue={slot.pickupLocation || ""} />
              </div>
              <div>
                <Label>Delivery Location</Label>
                <Input name="deliveryLocation" defaultValue={slot.deliveryLocation || ""} />
              </div>
              <div className="sm:col-span-2">
                <Label>Status</Label>
                <Select value={confirmed ? "confirmed" : "tentative"} onValueChange={(v) => setConfirmed(v === "confirmed")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tentative">Tentative</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea name="notes" defaultValue={slot.notes || ""} rows={2} />
              </div>
            </div>
            <div className="flex justify-between gap-3">
              {slot.id ? (
                <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(slot.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              ) : <div />}
              <Button type="submit">{slot.id ? "Save Changes" : "Add Load"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
