import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import {
  getLoads, saveLoads, getDrivers, getCars, saveCars, getLocations, saveLocations,
  getAddresses, saveAddresses,
  getPlanningSlots, savePlanningSlots, getDriverBoards, saveDriverBoards,
  generateId,
} from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { Address, Car, Load, LoadStatus, LocationProfile } from "@/lib/types";
import { decodeVin } from "@/lib/vin";
import { CalendarDays, Plus, Search, Filter, Truck, X } from "lucide-react";

const statusColor: Record<LoadStatus, string> = {
  booked: "bg-blue-100 text-blue-700",
  dispatched: "bg-amber-100 text-amber-700",
  in_transit: "bg-purple-100 text-purple-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusLabels: LoadStatus[] = ["booked", "dispatched", "in_transit", "delivered", "cancelled"];

const formatStatus = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Sync all loads to planning board — call from any page
// Creates missing slots AND patches existing slots with missing customer/carCount data
export function syncLoadsToPlanning(loads: Load[]) {
  const slots = getPlanningSlots();
  let changed = false;

  // Patch existing slots that have a loadId but missing customer/carCount
  const patched = slots.map((s) => {
    if (!s.loadId) return s;
    const load = loads.find((l) => l.id === s.loadId);
    if (!load) return s;
    const needsPatch = (!s.customer && load.customer) ||
      (!s.carCount && load.carIds?.length) ||
      (!s.pickupLocation && load.pickupLocation) ||
      (!s.deliveryLocation && load.deliveryLocation) ||
      (s.driverId !== load.driverId);
    if (!needsPatch) return s;
    changed = true;
    return {
      ...s,
      customer: s.customer || load.customer,
      carCount: s.carCount || load.carIds?.length,
      pickupLocation: s.pickupLocation || load.pickupLocation,
      deliveryLocation: s.deliveryLocation || load.deliveryLocation,
      driverId: load.driverId,
    };
  });

  // Create slots for loads that don't have one
  const slotLoadIds = new Set(patched.filter((s) => s.loadId).map((s) => s.loadId));
  const missing = loads.filter((l) => l.pickupDate && !slotLoadIds.has(l.id));

  if (missing.length === 0 && !changed) return;

  const newSlots = missing.map((l) => ({
    id: generateId(),
    date: l.pickupDate,
    driverId: l.driverId,
    customer: l.customer,
    loadSummary: [l.pickupLocation, l.deliveryLocation].filter(Boolean).join(" → ") || l.referenceNumber,
    pickupLocation: l.pickupLocation,
    deliveryLocation: l.deliveryLocation,
    carCount: l.carIds?.length || undefined,
    confirmed: l.status !== "booked",
    loadId: l.id,
    notes: l.referenceNumber,
  }));

  savePlanningSlots([...patched, ...newSlots]);
}

type PendingCar = {
  tempId: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  color: string;
  decoded: boolean;
};

export default function LoadsPage() {
  const loads = useStoreData(getLoads);
  const drivers = useStoreData(getDrivers);
  const cars = useStoreData(getCars);
  const locations = useStoreData(getLocations);
  const addresses = useStoreData(getAddresses);

  // Sync: ensure every load with a pickup date has a planning slot
  useEffect(() => {
    syncLoadsToPlanning(loads);
  }, [loads]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"pickup" | "delivered">("pickup");
  const [open, setOpen] = useState(false);
  const [newDriverId, setNewDriverId] = useState("");
  const [newCustomer, setNewCustomer] = useState(""); // customer code
  const [newPickup, setNewPickup] = useState("");     // address text
  const [newDelivery, setNewDelivery] = useState("");  // address text
  const [newPickupDate, setNewPickupDate] = useState<Date | undefined>(undefined);
  const [newCarCount, setNewCarCount] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [detailLoad, setDetailLoad] = useState<Load | null>(null);

  // Car entry state for new load dialog
  const [pendingCars, setPendingCars] = useState<PendingCar[]>([]);
  const [vinInput, setVinInput] = useState("");
  const [decoding, setDecoding] = useState(false);

  // Customer options — sorted by name (display name first, code secondary)
  const customerOptions = useMemo(
    () => locations.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [locations],
  );

  // Address options — sorted by name
  const addressOptions = useMemo(
    () => addresses.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [addresses],
  );

  const locationOptions = useMemo(
    () => locations.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [locations],
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
    const next: Address = {
      id: generateId(), name: value, line1: "", city: "", state: "", zip: "",
    };
    saveAddresses([...addresses, next]);
    return next.name;
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setNewDriverId("");
      setNewCustomer("");
      setNewPickup("");
      setNewDelivery("");
      setNewPickupDate(undefined);
      setNewCarCount("");
      setPendingCars([]);
      setVinInput("");
    }
  };

  const filtered = loads
    .filter((l) => {
      const matchSearch =
        l.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
        l.customer.toLowerCase().includes(search.toLowerCase()) ||
        l.pickupLocation.toLowerCase().includes(search.toLowerCase()) ||
        l.deliveryLocation.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === "delivered") return (b.deliveryDate || "").localeCompare(a.deliveryDate || "");
      return (b.pickupDate || "").localeCompare(a.pickupDate || "");
    });

  const parseVins = (raw: string): string[] => {
    return raw
      .split(/[\n,\t\r]+/)
      .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
      .filter((s) => s.length >= 5)
      .filter((s, i, arr) => arr.indexOf(s) === i);
  };

  const handleAddVins = async (raw: string) => {
    const vinList = parseVins(raw);
    if (vinList.length === 0) return;

    setDecoding(true);
    const existingVins = new Set(pendingCars.map((c) => c.vin));
    const newEntries: PendingCar[] = [];

    for (const vin of vinList) {
      if (existingVins.has(vin)) continue;
      existingVins.add(vin);
      try {
        const decoded = await decodeVin(vin);
        newEntries.push({ tempId: generateId(), vin, year: String(decoded.year), make: decoded.make, model: decoded.model, color: "", decoded: true });
      } catch {
        newEntries.push({ tempId: generateId(), vin, year: "", make: "", model: "", color: "", decoded: false });
      }
    }

    setPendingCars((prev) => [...prev, ...newEntries]);
    setVinInput("");
    setDecoding(false);
    if (newEntries.length > 0) {
      toast(`${newEntries.length} VIN${newEntries.length === 1 ? "" : "s"} added`);
    }
  };

  const removePendingCar = (tempId: string) => {
    setPendingCars((prev) => prev.filter((c) => c.tempId !== tempId));
  };

  // Car count: manual input wins, otherwise count VINs
  const effectiveCarCount = Number(newCarCount) || pendingCars.length || 0;

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pickupLocation = newPickup;
    const deliveryLocation = newDelivery;
    const customer = newCustomer;
    const pickupDate = newPickupDate ? format(newPickupDate, "yyyy-MM-dd") : "";
    const price = Number(fd.get("price")) || 0;
    const driverId = newDriverId || undefined;
    const customerLoc = locations.find((l) => l.code === customer);
    const customerPhone = customerLoc?.phone || "";

    // Generate load ID first so we can stamp it on every car
    const loadId = generateId();
    const refNumber = `LD-${new Date().getFullYear()}-${String(loads.length + 154).padStart(4, "0")}`;

    // Create Car records for each VIN
    const existingCars = getCars();
    const newCarRecords: Car[] = [];
    const carIds: string[] = [];

    for (const pc of pendingCars) {
      const existing = existingCars.find((c) => c.vin === pc.vin);
      if (existing) {
        carIds.push(existing.id);
        const idx = existingCars.findIndex((c) => c.id === existing.id);
        existingCars[idx] = {
          ...existing,
          status: "in_transit",
          loadId,
          pickupLocation,
          deliveryLocation,
          driverId,
          receivedDate: existing.receivedDate || pickupDate,
        };
      } else {
        const carId = generateId();
        carIds.push(carId);
        newCarRecords.push({
          id: carId,
          vin: pc.vin,
          year: Number(pc.year) || new Date().getFullYear(),
          make: pc.make || "Unknown",
          model: pc.model || "Unknown",
          vehicleName: `${pc.make} ${pc.model}`.trim() || "Unknown",
          color: pc.color || undefined,
          status: "at_shop",
          loadId,
          receivedDate: pickupDate,
          pickupLocation,
          deliveryLocation,
          driverId,
        });
      }
    }

    // Save cars
    saveCars([...existingCars, ...newCarRecords]);

    // Build vehicle info
    const vehicleInfo = pendingCars.length > 0
      ? pendingCars.map((c) => `${c.year} ${c.make} ${c.model}`.trim()).join(", ")
      : effectiveCarCount > 0
      ? `${effectiveCarCount} cars`
      : "";

    const newLoad: Load = {
      id: loadId,
      referenceNumber: refNumber,
      customer,
      customerPhone,
      pickupLocation,
      deliveryLocation,
      pickupDate,
      deliveryDate: "",
      vehicleInfo,
      status: "booked",
      driverId,
      price,
      notes: fd.get("notes") as string,
      carIds: carIds.length > 0 ? carIds : undefined,
    };
    saveLoads([...loads, newLoad]);

    // Add to Planning Board
    const existingSlots = getPlanningSlots();
    savePlanningSlots([...existingSlots, {
      id: generateId(),
      date: pickupDate,
      driverId: driverId,
      loadSummary: [effectiveCarCount ? `${effectiveCarCount} cars` : "", pickupLocation, deliveryLocation].filter(Boolean).join(" → ") || newLoad.referenceNumber,
      pickupLocation,
      deliveryLocation,
      carCount: effectiveCarCount || undefined,
      confirmed: !!driverId,
      notes: newLoad.referenceNumber,
    }]);

    // If driver is assigned and we have a date, add to Driver Recap board
    if (driverId && pickupDate) {
      const existingBoards = getDriverBoards();
      const existingBoard = existingBoards.find((b) => b.driverId === driverId && b.date === pickupDate);
      const newStop = {
        id: generateId(),
        carCount: effectiveCarCount,
        pickupLocation,
        dropoffLocation: deliveryLocation,
        status: "completed" as const,
        notes: newLoad.referenceNumber,
      };

      if (existingBoard) {
        // Append to existing board
        const updatedStops = [...(existingBoard.stops || []), newStop];
        saveDriverBoards(existingBoards.map((b) =>
          b.id === existingBoard.id
            ? { ...b, stops: updatedStops, items: updatedStops.map((s) => `${s.carCount}-${s.pickupLocation}`), updatedAt: new Date().toISOString() }
            : b,
        ));
      } else {
        // Create new board entry
        saveDriverBoards([...existingBoards, {
          id: generateId(),
          driverId,
          date: pickupDate,
          items: [`${newStop.carCount}-${pickupLocation}`],
          stops: [newStop],
          updatedAt: new Date().toISOString(),
        }]);
      }
    }

    handleOpenChange(false);
    toast("Load created", {
      description: `Added to Planning Board${driverId ? " + Driver Recap" : ""}${newCarRecords.length > 0 ? ` · ${newCarRecords.length} car${newCarRecords.length === 1 ? "" : "s"} added to Cars` : ""}`,
    });
  };

  const updateStatus = (id: string, status: LoadStatus) => {
    const load = loads.find((l) => l.id === id);
    if (!load) return;

    // Update linked cars when load status changes
    if (load.carIds?.length) {
      const allCars = getCars();
      const updatedCars = allCars.map((car) => {
        if (!load.carIds!.includes(car.id)) return car;
        if (status === "delivered") {
          return { ...car, status: "delivered" as const, deliveredDate: new Date().toISOString().split("T")[0] };
        }
        if (status === "in_transit") {
          return { ...car, status: "in_transit" as const };
        }
        if (status === "cancelled") {
          return { ...car, status: "at_shop" as const };
        }
        return car;
      });
      saveCars(updatedCars);
    }

    const today = new Date().toISOString().split("T")[0];
    saveLoads(loads.map((l) => {
      if (l.id !== id) return l;
      return {
        ...l,
        status,
        deliveryDate: status === "delivered" ? today : "",
      };
    }));
  };

  // Cars linked to a specific load (for detail view)
  const getLoadCars = (load: Load): Car[] => {
    if (!load.carIds?.length) return [];
    return cars.filter((c) => load.carIds!.includes(c.id));
  };

  // Display address or fall back to raw value
  const addressDisplay = (val: string): string => {
    if (!val) return "—";
    const addr = addresses.find((a) => a.name === val);
    if (addr && addr.city) return `${addr.name}, ${addr.city} ${addr.state}`.trim();
    if (addr) return addr.name;
    // Legacy: try locations
    const loc = locations.find((l) => l.code === val);
    if (loc) {
      const parts = loc.address?.split(",").map((s) => s.trim()) || [];
      const city = parts.length >= 2 ? parts.slice(-2).join(", ") : "";
      return city ? `${loc.name} (${city})` : loc.name;
    }
    return val;
  };

  // Display customer name from code
  const customerDisplay = (code: string): string => {
    if (!code) return "—";
    // Try by code first
    const byCode = locations.find((l) => l.code === code);
    if (byCode) return byCode.name;
    // Try by name
    const byName = locations.find((l) => l.name === code);
    if (byName) return byName.name;
    // If it contains arrows, it's an old summary — try to extract customer from it
    if (code.includes("→")) {
      const parts = code.split("→").map((s) => s.trim());
      // Try first part (might be "9 cars") or second part
      for (const part of parts) {
        if (/^\d+\s*cars?$/i.test(part)) continue; // skip "9 cars"
        const match = locations.find((l) => l.name === part || l.code === part);
        if (match) return match.name;
      }
    }
    return code;
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loads</h1>
          <p className="text-muted-foreground text-sm mt-1">{loads.length} total shipments</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Load</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create New Load</DialogTitle></DialogHeader>
            <form key={open ? "open" : "closed"} onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Customer</Label>
                  <CustomerSearchInput
                    value={newCustomer}
                    onChange={setNewCustomer}
                    options={customerOptions}
                    onCreate={handleCreateLocation}
                    placeholder="Search by name..."
                  />
                </div>
                <div>
                  <Label>Pickup Address</Label>
                  <AddressSearchInput
                    value={newPickup}
                    onChange={setNewPickup}
                    options={addressOptions}
                    onCreate={handleCreateAddress}
                    placeholder="Search address..."
                  />
                </div>
                <div>
                  <Label>Delivery Address</Label>
                  <AddressSearchInput
                    value={newDelivery}
                    onChange={setNewDelivery}
                    options={addressOptions}
                    onCreate={handleCreateAddress}
                    placeholder="Search address..."
                  />
                </div>
                {/* Pickup date — calendar */}
                <div>
                  <Label>Pickup Date</Label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                        {newPickupDate ? format(newPickupDate, "EEE, MMM d, yyyy") : <span className="text-muted-foreground">Select date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newPickupDate}
                        onSelect={(d) => { if (d) { setNewPickupDate(d); setDatePickerOpen(false); } }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Car count — manual or auto from VINs */}
                <div>
                  <Label>
                    Cars
                    {pendingCars.length > 0 && !newCarCount && (
                      <span className="ml-1 text-xs text-muted-foreground">({pendingCars.length} from VINs)</span>
                    )}
                  </Label>
                  <Input
                    value={newCarCount}
                    onChange={(e) => setNewCarCount(e.target.value.replace(/\D/g, ""))}
                    placeholder={pendingCars.length > 0 ? String(pendingCars.length) : "e.g. 9"}
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <Label>Price ($)</Label>
                  <Input name="price" type="number" step="0.01" min="0" />
                </div>
                <div>
                  <Label>Assign Driver</Label>
                  <Select value={newDriverId} onValueChange={setNewDriverId}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      {drivers.filter((d) => d.status === "active").map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cars on this load */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Cars on this Load</Label>
                  <div className="flex items-center gap-2">
                    {pendingCars.length > 0 && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary">{pendingCars.length} car{pendingCars.length === 1 ? "" : "s"}</Badge>
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

                {pendingCars.length > 0 && (
                  <div className="space-y-2">
                    {pendingCars.map((pc) => (
                      <div key={pc.tempId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <span className="font-mono text-xs flex-1">{pc.vin}</span>
                        {pc.decoded ? (
                          <span className="text-muted-foreground">{pc.year} {pc.make} {pc.model}</span>
                        ) : (
                          <div className="flex gap-1.5">
                            <Input
                              className="h-7 w-16 text-xs"
                              placeholder="Year"
                              value={pc.year}
                              onChange={(e) => setPendingCars((prev) => prev.map((c) => c.tempId === pc.tempId ? { ...c, year: e.target.value } : c))}
                            />
                            <Input
                              className="h-7 w-20 text-xs"
                              placeholder="Make"
                              value={pc.make}
                              onChange={(e) => setPendingCars((prev) => prev.map((c) => c.tempId === pc.tempId ? { ...c, make: e.target.value } : c))}
                            />
                            <Input
                              className="h-7 w-20 text-xs"
                              placeholder="Model"
                              value={pc.model}
                              onChange={(e) => setPendingCars((prev) => prev.map((c) => c.tempId === pc.tempId ? { ...c, model: e.target.value } : c))}
                            />
                          </div>
                        )}
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removePendingCar(pc.tempId)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      {pendingCars.length} car{pendingCars.length === 1 ? "" : "s"} — will be added to Cars dashboard when load is created
                    </p>
                  </div>
                )}

                {pendingCars.length === 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Or describe vehicles manually</Label>
                    <Input name="vehicleInfo" placeholder="e.g. 2024 Toyota Camry, 2023 Ford F-150" />
                  </div>
                )}
              </div>

              <div><Label>Notes</Label><Textarea name="notes" rows={2} /></div>
              <Button type="submit" className="w-full">Create Load</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search loads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-3.5 w-3.5 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusLabels.map((s) => (
              <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Truck className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {search || statusFilter !== "all" ? "No loads match your filters" : "No loads yet"}
              </p>
              {!search && statusFilter === "all" && (
                <p className="text-xs text-muted-foreground mt-1">Create your first load to get started.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Cars</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground" onClick={() => setSortBy(sortBy === "pickup" ? "delivered" : "pickup")}>
                    Pickup {sortBy === "pickup" && "↓"}
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground" onClick={() => setSortBy(sortBy === "delivered" ? "pickup" : "delivered")}>
                    Delivered {sortBy === "delivered" && "↓"}
                  </TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const driver = drivers.find((d) => d.id === l.driverId);
                  const loadCars = getLoadCars(l);
                  const missingVins = !l.carIds || l.carIds.length === 0;
                  const missingPrice = !l.price || l.price === 0;
                  const incomplete = (missingVins || missingPrice) && l.status !== "cancelled";
                  const nextStatus: Record<string, LoadStatus> = {
                    booked: "dispatched",
                    dispatched: "in_transit",
                    in_transit: "delivered",
                  };
                  return (
                    <TableRow key={l.id} className={`cursor-pointer ${incomplete ? "bg-red-50 shadow-[inset_0_0_0_2px_rgba(239,68,68,0.4)]" : "hover:bg-muted/50"}`} onClick={() => setDetailLoad(l)}>
                      <TableCell className="font-mono text-sm">{l.referenceNumber}</TableCell>
                      <TableCell className="font-medium">{customerDisplay(l.customer)}</TableCell>
                      <TableCell className="text-sm">{l.pickupLocation || "—"} → {l.deliveryLocation || "—"}</TableCell>
                      <TableCell>
                        {loadCars.length > 0 ? (
                          <span className="text-sm font-medium">{loadCars.length}</span>
                        ) : (
                          <div>
                            <span className="text-sm font-medium">{l.vehicleInfo?.match(/\d+/)?.[0] || "—"}</span>
                            {missingVins && <p className="text-[8px] text-red-600 font-semibold uppercase leading-tight whitespace-nowrap">VINs Pending</p>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{driver?.name || "—"}</TableCell>
                      <TableCell className="text-sm tabular-nums">{l.pickupDate ? format(new Date(`${l.pickupDate}T12:00:00`), "MM-dd") : "—"}</TableCell>
                      <TableCell className="text-sm tabular-nums">{l.deliveryDate ? format(new Date(`${l.deliveryDate}T12:00:00`), "MM-dd") : "—"}</TableCell>
                      <TableCell className="tabular-nums font-medium">${l.price.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColor[l.status]}>{formatStatus(l.status)}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {nextStatus[l.status] && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(l.id, nextStatus[l.status])}>
                            → {formatStatus(nextStatus[l.status])}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Load detail/edit dialog */}
      {detailLoad && (
        <LoadEditDialog
          load={detailLoad}
          drivers={drivers}
          cars={cars}
          customerOptions={customerOptions}
          addressOptions={addressOptions}
          onCreateLocation={handleCreateLocation}
          onCreateAddress={handleCreateAddress}
          onSave={(updated, newCarIds) => {
            saveLoads(loads.map((l) => (l.id === updated.id ? updated : l)));
            if (newCarIds.length > 0) {
              // Refresh cars from store since they were saved inside the dialog
            }
            setDetailLoad(null);
            toast("Load updated");
          }}
          onClose={() => setDetailLoad(null)}
        />
      )}
    </div>
  );
}

// ─── Load Edit Dialog ─────────────────────────────────────────────────────────

function LoadEditDialog({
  load, drivers, cars, customerOptions, addressOptions, onCreateLocation, onCreateAddress, onSave, onClose,
}: {
  load: Load;
  drivers: ReturnType<typeof getDrivers>;
  cars: Car[];
  customerOptions: LocationProfile[];
  addressOptions: Address[];
  onCreateLocation: (raw: string) => string;
  onCreateAddress: (raw: string) => string;
  onSave: (updated: Load, newCarIds: string[]) => void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(String(load.price || ""));
  const [driverId, setDriverId] = useState(load.driverId || "");
  const [customer, setCustomer] = useState(load.customer);
  const [pickup, setPickup] = useState(load.pickupLocation);
  const [delivery, setDelivery] = useState(load.deliveryLocation);
  const [editStatus, setEditStatus] = useState<LoadStatus>(load.status);
  const [notes, setNotes] = useState(load.notes);
  const [vinInput, setVinInput] = useState("");
  const [pendingVins, setPendingVins] = useState<PendingCar[]>([]);
  const [addingVins, setAddingVins] = useState(false);

  const loadCars = cars.filter((c) => load.carIds?.includes(c.id));
  const missingVins = !load.carIds || load.carIds.length === 0;
  const missingPrice = !load.price || load.price === 0;

  const parseVinList = (raw: string): string[] =>
    raw.split(/[\n,\t\r]+/).map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")).filter((s) => s.length >= 5).filter((s, i, a) => a.indexOf(s) === i);

  const handleQueueVins = async (raw: string) => {
    const vinList = parseVinList(raw);
    if (vinList.length === 0) return;
    setAddingVins(true);
    const existingSet = new Set([...loadCars.map((c) => c.vin), ...pendingVins.map((v) => v.vin)]);
    const newEntries: PendingCar[] = [];
    for (const vin of vinList) {
      if (existingSet.has(vin)) continue;
      existingSet.add(vin);
      try {
        const decoded = await decodeVin(vin);
        newEntries.push({ tempId: generateId(), vin, year: String(decoded.year), make: decoded.make, model: decoded.model, color: "", decoded: true });
      } catch {
        newEntries.push({ tempId: generateId(), vin, year: "", make: "", model: "", color: "", decoded: false });
      }
    }
    setPendingVins((prev) => [...prev, ...newEntries]);
    setVinInput("");
    setAddingVins(false);
  };

  const handleSaveVins = async () => {
    if (pendingVins.length === 0) return;
    const existingCars = getCars();
    const newCars: Car[] = [];
    const newIds: string[] = [];

    for (const pv of pendingVins) {
      const existing = existingCars.find((c) => c.vin === pv.vin);
      if (existing) {
        newIds.push(existing.id);
        const idx = existingCars.findIndex((c) => c.id === existing.id);
        existingCars[idx] = { ...existing, loadId: load.id, pickupLocation: pickup, deliveryLocation: delivery, driverId: driverId || undefined };
      } else {
        const carId = generateId();
        newIds.push(carId);
        newCars.push({
          id: carId, vin: pv.vin, year: Number(pv.year) || new Date().getFullYear(),
          make: pv.make || "Unknown", model: pv.model || "Unknown",
          vehicleName: `${pv.make} ${pv.model}`.trim() || "Unknown",
          status: "at_shop", loadId: load.id,
          receivedDate: load.pickupDate, pickupLocation: pickup, deliveryLocation: delivery,
          driverId: driverId || undefined,
        });
      }
    }

    saveCars([...existingCars, ...newCars]);
    const allCarIds = [...(load.carIds || []), ...newIds];
    const updated = { ...load, carIds: allCarIds };
    saveLoads(getLoads().map((l) => (l.id === load.id ? updated : l)));
    setPendingVins([]);
    onSave(updated, newIds);
  };

  const handleSave = () => {
    const today = new Date().toISOString().split("T")[0];
    const newDriverId = driverId || undefined;
    const updated: Load = {
      ...load,
      customer,
      pickupLocation: pickup,
      deliveryLocation: delivery,
      status: editStatus,
      deliveryDate: editStatus === "delivered" ? (load.deliveryDate || today) : "",
      price: Number(price) || 0,
      driverId: newDriverId,
      notes,
    };

    // Update linked cars when status changes
    if (editStatus !== load.status && updated.carIds?.length) {
      const allCars = getCars();
      const updatedCars = allCars.map((car) => {
        if (!updated.carIds!.includes(car.id)) return car;
        if (editStatus === "delivered") return { ...car, status: "delivered" as const, deliveredDate: today };
        if (editStatus === "in_transit") return { ...car, status: "in_transit" as const };
        if (editStatus === "cancelled" || editStatus === "booked") return { ...car, status: "at_shop" as const };
        return car;
      });
      saveCars(updatedCars);
    }

    // Sync driver changes back to Planning Board
    if (newDriverId !== load.driverId) {
      const slots = getPlanningSlots();
      const linkedSlot = slots.find((s) => s.loadId === load.id);
      if (linkedSlot) {
        savePlanningSlots(slots.map((s) =>
          s.id === linkedSlot.id
            ? { ...s, driverId: newDriverId, confirmed: !newDriverId ? false : s.confirmed }
            : s,
        ));
      }
    }

    onSave(updated, []);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{load.referenceNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Customer {!customer && <span className="text-red-500">*</span>}</Label>
              <CustomerSearchInput value={customer} onChange={setCustomer} options={customerOptions} onCreate={onCreateLocation} placeholder="Search by name..." />
            </div>
            <div>
              <Label>Price ($) {missingPrice && <span className="text-red-500">*</span>}</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" placeholder="Enter price" />
            </div>
            <div>
              <Label>Pickup Address</Label>
              <AddressSearchInput value={pickup} onChange={setPickup} options={addressOptions} onCreate={onCreateAddress} placeholder="Search address..." />
            </div>
            <div>
              <Label>Delivery Address</Label>
              <AddressSearchInput value={delivery} onChange={setDelivery} options={addressOptions} onCreate={onCreateAddress} placeholder="Search address..." />
            </div>
            <div>
              <Label>Driver</Label>
              <Select value={driverId || "unassigned"} onValueChange={(v) => setDriverId(v === "unassigned" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {drivers.filter((d) => d.status === "active").map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as LoadStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cars section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Cars on this Load
              {missingVins && <span className="text-red-500 ml-1">* Needs VINs</span>}
              {loadCars.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">{loadCars.length}</Badge>
              )}
            </h3>

            {loadCars.length > 0 && (
              <div className="space-y-1.5">
                {loadCars.map((car) => (
                  <div key={car.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <span className="font-mono text-xs">{car.vin}</span>
                      <span className="ml-2 text-muted-foreground">{car.year} {car.make} {car.model}</span>
                    </div>
                    <Badge variant="secondary" className={
                      car.status === "delivered" ? "bg-emerald-100 text-emerald-700"
                      : car.status === "in_transit" ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                    }>
                      {car.status === "at_shop" ? "At Shop" : car.status === "in_transit" ? "In Transit" : "Delivered"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Add VINs */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={vinInput}
                  onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                  placeholder="Enter or paste VINs"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleQueueVins(vinInput); } }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted.includes("\n") || pasted.includes(",")) {
                      e.preventDefault();
                      handleQueueVins(pasted);
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => handleQueueVins(vinInput)} disabled={addingVins || !vinInput.trim()}>
                  {addingVins ? "..." : "Add"}
                </Button>
              </div>

              {/* Pending VINs - staged before saving */}
              {pendingVins.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-dashed border-primary/30 p-2">
                  <p className="text-xs font-medium text-primary px-1">
                    {pendingVins.length} new VIN{pendingVins.length === 1 ? "" : "s"} to add:
                  </p>
                  {pendingVins.map((pv) => (
                    <div key={pv.tempId} className="flex items-center gap-2 rounded border bg-white px-2.5 py-1.5 text-sm">
                      <span className="font-mono text-xs flex-1">{pv.vin}</span>
                      {pv.decoded ? (
                        <span className="text-muted-foreground text-xs">{pv.year} {pv.make} {pv.model}</span>
                      ) : (
                        <div className="flex gap-1">
                          <Input className="h-6 w-14 text-xs" placeholder="Year" value={pv.year}
                            onChange={(e) => setPendingVins((prev) => prev.map((v) => v.tempId === pv.tempId ? { ...v, year: e.target.value } : v))} />
                          <Input className="h-6 w-16 text-xs" placeholder="Make" value={pv.make}
                            onChange={(e) => setPendingVins((prev) => prev.map((v) => v.tempId === pv.tempId ? { ...v, make: e.target.value } : v))} />
                          <Input className="h-6 w-16 text-xs" placeholder="Model" value={pv.model}
                            onChange={(e) => setPendingVins((prev) => prev.map((v) => v.tempId === pv.tempId ? { ...v, model: e.target.value } : v))} />
                        </div>
                      )}
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                        onClick={() => setPendingVins((prev) => prev.filter((v) => v.tempId !== pv.tempId))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" className="w-full" onClick={handleSaveVins}>
                    Save {pendingVins.length} VIN{pendingVins.length === 1 ? "" : "s"} to Load
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Searchable Location Input ────────────────────────────────────────────────

function LocationSearchInput({
  value, onChange, options, onCreate, placeholder,
}: {
  value: string;
  onChange: (code: string) => void;
  options: LocationProfile[];
  onCreate: (raw: string) => string;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const display = value
    ? (options.find((l) => l.code === value)?.let ?? `${value} — ${options.find((l) => l.code === value)?.name || ""}`)
    : "";

  const filtered = options.filter((l) =>
    !search || l.code.includes(search.toUpperCase()) || l.name.toUpperCase().includes(search.toUpperCase()),
  );

  const canCreate = search.trim().length > 0 && !options.some((l) => l.code === search.trim().toUpperCase());

  return (
    <div className="relative">
      <Input
        value={focused ? search : (value ? `${value}${options.find((l) => l.code === value) ? ` — ${options.find((l) => l.code === value)!.name}` : ""}` : "")}
        onChange={(e) => { setSearch(e.target.value); if (!e.target.value) onChange(""); }}
        onFocus={() => { setFocused(true); setSearch(value); }}
        onBlur={() => setTimeout(() => { setFocused(false); setSearch(""); }, 150)}
        placeholder={placeholder}
      />
      {focused && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${value === l.code ? "bg-muted" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); onChange(l.code); setFocused(false); setSearch(""); }}
            >
              <span className="font-medium">{l.code}</span>
              <span className="text-muted-foreground ml-2">{l.name}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 text-primary"
              onMouseDown={(e) => {
                e.preventDefault();
                const code = onCreate(search);
                if (code) onChange(code);
                setFocused(false);
                setSearch("");
              }}
            >
              <Plus className="inline h-3 w-3 mr-1" />Create "{search.trim()}"
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No locations found</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Customer Search (name first, code secondary) ─────────────────────────────

function CustomerSearchInput({
  value, onChange, options, onCreate, placeholder,
}: {
  value: string;
  onChange: (code: string) => void;
  options: LocationProfile[];
  onCreate: (raw: string) => string;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const selected = options.find((l) => l.code === value);
  const displayVal = selected ? `${selected.name} (${selected.code})` : value;

  const filtered = options.filter((l) =>
    !search || l.name.toUpperCase().includes(search.toUpperCase()) || l.code.includes(search.toUpperCase()),
  ).slice(0, 20);

  const canCreate = search.trim().length > 0 && !options.some((l) =>
    l.name.toUpperCase() === search.trim().toUpperCase() || l.code === search.trim().toUpperCase(),
  );

  return (
    <div className="relative">
      <Input
        value={focused ? search : displayVal}
        onChange={(e) => { setSearch(e.target.value); if (!e.target.value) onChange(""); }}
        onFocus={() => { setFocused(true); setSearch(value ? (selected?.name || value) : ""); }}
        onBlur={() => setTimeout(() => { setFocused(false); setSearch(""); }, 150)}
        placeholder={placeholder}
      />
      {focused && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-y-auto">
          {filtered.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${value === l.code ? "bg-muted" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); onChange(l.code); setFocused(false); setSearch(""); }}
            >
              <span className="font-medium">{l.name}</span>
              <span className="text-muted-foreground ml-2 text-xs font-mono">{l.code}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 text-primary"
              onMouseDown={(e) => { e.preventDefault(); const c = onCreate(search); if (c) onChange(c); setFocused(false); setSearch(""); }}
            >
              <Plus className="inline h-3 w-3 mr-1" />Add "{search.trim()}"
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No customers found</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Address Search (for pickup/delivery) ─────────────────────────────────────

function AddressSearchInput({
  value, onChange, options, onCreate, placeholder,
}: {
  value: string;
  onChange: (name: string) => void;
  options: Address[];
  onCreate: (raw: string) => string;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const selected = options.find((a) => a.name === value);
  const displayVal = selected
    ? (selected.city ? `${selected.name}, ${selected.city} ${selected.state}` : selected.name)
    : value;

  const filtered = options.filter((a) =>
    !search ||
    a.name.toUpperCase().includes(search.toUpperCase()) ||
    a.city.toUpperCase().includes(search.toUpperCase()) ||
    a.line1.toUpperCase().includes(search.toUpperCase()),
  ).slice(0, 20);

  const canCreate = search.trim().length > 0 && !options.some((a) =>
    a.name.toUpperCase() === search.trim().toUpperCase(),
  );

  return (
    <div className="relative">
      <Input
        value={focused ? search : displayVal}
        onChange={(e) => { setSearch(e.target.value); if (!e.target.value) onChange(""); }}
        onFocus={() => { setFocused(true); setSearch(value || ""); }}
        onBlur={() => setTimeout(() => { setFocused(false); setSearch(""); }, 150)}
        placeholder={placeholder}
      />
      {focused && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-y-auto">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${value === a.name ? "bg-muted" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); onChange(a.name); setFocused(false); setSearch(""); }}
            >
              <span className="font-medium">{a.name}</span>
              {a.city && <span className="text-muted-foreground ml-2 text-xs">{a.city}, {a.state}</span>}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 text-primary"
              onMouseDown={(e) => { e.preventDefault(); const n = onCreate(search); if (n) onChange(n); setFocused(false); setSearch(""); }}
            >
              <Plus className="inline h-3 w-3 mr-1" />Add "{search.trim()}"
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No addresses found</p>
          )}
        </div>
      )}
    </div>
  );
}
