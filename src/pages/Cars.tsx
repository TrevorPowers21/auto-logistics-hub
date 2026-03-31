import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useStoreData } from "@/hooks/use-store";
import { decodeVin } from "@/lib/vin";
import {
  generateId, getCars, saveCars, getDrivers, getLoads, saveLoads,
  getLocations, saveLocations, getDriverBoards, saveDriverBoards,
} from "@/lib/store";
import { Car, CarStatus, Load, LocationProfile } from "@/lib/types";
import { AlertCircle, Car as CarIcon, Plus, Search, Truck, X } from "lucide-react";

const statusConfig: Record<CarStatus, { label: string; badge: string }> = {
  at_shop: { label: "At Shop", badge: "bg-amber-100 text-amber-700" },
  in_transit: { label: "In Transit", badge: "bg-blue-100 text-blue-700" },
  delivered: { label: "Delivered", badge: "bg-emerald-100 text-emerald-700" },
};

function getDwellDays(car: Car): number | null {
  if (!car.receivedDate) return null;
  const from = new Date(car.receivedDate);
  const to = car.deliveredDate ? new Date(car.deliveredDate) : new Date();
  to.setHours(0, 0, 0, 0);
  from.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export default function CarsPage() {
  const cars = useStoreData(getCars);
  const drivers = useStoreData(getDrivers);
  const allLoads = useStoreData(getLoads);
  const locations = useStoreData(getLocations);
  const [statusFilter, setStatusFilter] = useState<CarStatus | "all">("at_shop");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [localLoadOpen, setLocalLoadOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | null>(null);

  // Add form state
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [decoding, setDecoding] = useState(false);

  // Local load state
  const [localVins, setLocalVins] = useState<Array<{ tempId: string; vin: string; year: string; make: string; model: string; decoded: boolean }>>([]);
  const [localVinInput, setLocalVinInput] = useState("");
  const [localDecoding, setLocalDecoding] = useState(false);
  const [localDriverId, setLocalDriverId] = useState("");
  const [localPickup, setLocalPickup] = useState("");
  const [localDelivery, setLocalDelivery] = useState("");
  const [localReason, setLocalReason] = useState("staging");
  const [localPickupSearch, setLocalPickupSearch] = useState("");
  const [localDeliverySearch, setLocalDeliverySearch] = useState("");

  // Edit form state
  const [editStatus, setEditStatus] = useState<CarStatus>("at_shop");
  const [editDriverId, setEditDriverId] = useState("");

  const locationOptions = useMemo(
    () => locations.slice().sort((a, b) => a.code.localeCompare(b.code)),
    [locations],
  );

  const handleCreateLocation = (raw: string): string => {
    const value = raw.trim();
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

  const filtered = useMemo(() => {
    return cars
      .filter((c) => {
        const matchStatus = statusFilter === "all" || c.status === statusFilter || (!c.status && statusFilter === "at_shop");
        const matchSearch =
          !search ||
          c.vin.toLowerCase().includes(search.toLowerCase()) ||
          c.make.toLowerCase().includes(search.toLowerCase()) ||
          c.model.toLowerCase().includes(search.toLowerCase()) ||
          c.vehicleName.toLowerCase().includes(search.toLowerCase()) ||
          (c.color || "").toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
      })
      .sort((a, b) => {
        // Sort based on which tab is active
        if (statusFilter === "at_shop") {
          // Longest dwell first — cars sitting the longest are most urgent
          return (getDwellDays(b) ?? 0) - (getDwellDays(a) ?? 0);
        }
        if (statusFilter === "delivered") {
          // Most recently delivered first — daily pay reconciliation
          return (b.deliveredDate || "").localeCompare(a.deliveredDate || "");
        }
        if (statusFilter === "in_transit") {
          // Most recently picked up first
          return (b.receivedDate || "").localeCompare(a.receivedDate || "");
        }
        // "All" tab — group by status, then sort within each group
        const aStatus = a.status || "at_shop";
        const bStatus = b.status || "at_shop";
        const order: Record<CarStatus, number> = { at_shop: 0, in_transit: 1, delivered: 2 };
        if (aStatus !== bStatus) return order[aStatus] - order[bStatus];
        if (aStatus === "at_shop") return (getDwellDays(b) ?? 0) - (getDwellDays(a) ?? 0);
        if (aStatus === "delivered") return (b.deliveredDate || "").localeCompare(a.deliveredDate || "");
        return (b.receivedDate || "").localeCompare(a.receivedDate || "");
      });
  }, [cars, statusFilter, search]);

  const counts = useMemo(() => ({
    all: cars.length,
    at_shop: cars.filter((c) => !c.status || c.status === "at_shop").length,
    in_transit: cars.filter((c) => c.status === "in_transit").length,
    delivered: cars.filter((c) => c.status === "delivered").length,
  }), [cars]);

  const resetAddForm = () => {
    setVin(""); setYear(""); setMake(""); setModel("");
    setVehicleName(""); setColor(""); setNotes("");
  };

  const handleDecodeVin = async () => {
    try {
      setDecoding(true);
      const decoded = await decodeVin(vin);
      setYear(String(decoded.year));
      setMake(decoded.make);
      setModel(decoded.model);
      setVehicleName(decoded.vehicleName);
      toast("VIN decoded", { description: "Year, make, model filled in." });
    } catch (error) {
      toast("VIN lookup failed", {
        description: error instanceof Error ? error.message : "Unable to decode VIN.",
      });
    } finally {
      setDecoding(false);
    }
  };

  const handleAddCar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newCar: Car = {
      id: generateId(),
      vin: vin.trim().toUpperCase(),
      year: Number(year),
      make: make.trim(),
      model: model.trim(),
      vehicleName: vehicleName.trim() || `${make.trim()} ${model.trim()}`.trim(),
      color: color.trim(),
      notes: notes.trim(),
      status: "at_shop",
      receivedDate: (fd.get("receivedDate") as string) || new Date().toISOString().split("T")[0],
      pickupLocation: fd.get("pickupLocation") as string || undefined,
    };
    saveCars([...cars, newCar]);
    setAddOpen(false);
    resetAddForm();
  };

  const handleEditOpen = (car: Car) => {
    setEditingCar(car);
    setEditStatus(car.status || "at_shop");
    setEditDriverId(car.driverId || "");
  };

  const handleEditSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCar) return;
    const fd = new FormData(e.currentTarget);
    const updated: Car = {
      ...editingCar,
      color: fd.get("color") as string || editingCar.color,
      notes: fd.get("notes") as string,
      status: editStatus,
      receivedDate: fd.get("receivedDate") as string || editingCar.receivedDate,
      deliveredDate: editStatus === "delivered" ? (fd.get("deliveredDate") as string || editingCar.deliveredDate) : undefined,
      pickupLocation: fd.get("pickupLocation") as string || undefined,
      deliveryLocation: editStatus === "delivered" ? (fd.get("deliveryLocation") as string || undefined) : editingCar.deliveryLocation,
      driverId: editDriverId || undefined,
    };
    saveCars(cars.map((c) => (c.id === editingCar.id ? updated : c)));
    setEditingCar(null);
    toast("Car updated", { description: `${updated.year} ${updated.make} ${updated.model} saved.` });
  };

  const handleDelete = (id: string) => {
    saveCars(cars.filter((c) => c.id !== id));
    setEditingCar(null);
    toast("Car removed");
  };

  const resetLocalLoad = () => {
    setLocalVins([]);
    setLocalVinInput("");
    setLocalDriverId("");
    setLocalPickup("");
    setLocalDelivery("");
    setLocalReason("staging");
    setLocalPickupSearch("");
    setLocalDeliverySearch("");
  };

  const handleAddLocalVin = async () => {
    const raw = localVinInput.trim().toUpperCase();
    if (!raw) return;
    const vinList = raw.split(/[\n,\t\r]+/).map((s) => s.trim().replace(/[^A-Z0-9]/g, "")).filter((s) => s.length >= 5);
    if (vinList.length === 0) return;

    setLocalDecoding(true);
    const existing = new Set(localVins.map((v) => v.vin));
    const newEntries: typeof localVins = [];
    for (const v of vinList) {
      if (existing.has(v) || localVins.length + newEntries.length >= 4) continue;
      existing.add(v);
      try {
        const decoded = await decodeVin(v);
        newEntries.push({ tempId: generateId(), vin: v, year: String(decoded.year), make: decoded.make, model: decoded.model, decoded: true });
      } catch {
        newEntries.push({ tempId: generateId(), vin: v, year: "", make: "", model: "", decoded: false });
      }
    }
    setLocalVins((prev) => [...prev, ...newEntries]);
    setLocalVinInput("");
    setLocalDecoding(false);
  };

  const handleLocalLoadSubmit = () => {
    if (localVins.length === 0 || !localDriverId) return;

    const loadId = generateId();
    const refNumber = `LL-${new Date().getFullYear()}-${String(allLoads.length + 1).padStart(4, "0")}`;
    const today = new Date().toISOString().split("T")[0];
    const reasonLabels: Record<string, string> = {
      staging: "Staging for truck",
      auction: "Auction",
      customer_delivery: "Customer delivery",
      other: "Local move",
    };

    // Create car records
    const existingCars = getCars();
    const newCars: Car[] = [];
    const carIds: string[] = [];

    for (const pv of localVins) {
      const existingCar = existingCars.find((c) => c.vin === pv.vin);
      if (existingCar) {
        carIds.push(existingCar.id);
        const idx = existingCars.findIndex((c) => c.id === existingCar.id);
        existingCars[idx] = { ...existingCar, status: "in_transit", loadId, pickupLocation: localPickup, deliveryLocation: localDelivery || "SHOP", driverId: localDriverId, receivedDate: existingCar.receivedDate || today };
      } else {
        const carId = generateId();
        carIds.push(carId);
        newCars.push({
          id: carId, vin: pv.vin, year: Number(pv.year) || new Date().getFullYear(),
          make: pv.make || "Unknown", model: pv.model || "Unknown",
          vehicleName: `${pv.make} ${pv.model}`.trim() || "Unknown",
          status: "in_transit", loadId, receivedDate: today,
          pickupLocation: localPickup, deliveryLocation: localDelivery || "SHOP", driverId: localDriverId,
        });
      }
    }
    saveCars([...existingCars, ...newCars]);

    // Create a load record
    const newLoad: Load = {
      id: loadId, referenceNumber: refNumber,
      customer: reasonLabels[localReason] || "Local Load",
      customerPhone: "",
      pickupLocation: localPickup, deliveryLocation: localDelivery || "SHOP",
      pickupDate: today, deliveryDate: "",
      vehicleInfo: localVins.map((v) => `${v.year} ${v.make} ${v.model}`.trim()).join(", "),
      status: "in_transit", driverId: localDriverId,
      price: 0, notes: `Local load — ${reasonLabels[localReason]}`,
      carIds,
    };
    saveLoads([...allLoads, newLoad]);

    // Add to driver recap
    const boards = getDriverBoards();
    const existingBoard = boards.find((b) => b.driverId === localDriverId && b.date === today);
    const newStop = {
      id: generateId(), carCount: localVins.length,
      pickupLocation: localPickup, dropoffLocation: localDelivery || "SHOP",
      status: "completed" as const, notes: `Local: ${reasonLabels[localReason]}`,
    };
    if (existingBoard) {
      const updatedStops = [...(existingBoard.stops || []), newStop];
      saveDriverBoards(boards.map((b) => b.id === existingBoard.id ? { ...b, stops: updatedStops, items: updatedStops.map((s) => `${s.carCount}-${s.pickupLocation}`), updatedAt: new Date().toISOString() } : b));
    } else {
      saveDriverBoards([...boards, { id: generateId(), driverId: localDriverId, date: today, items: [`${newStop.carCount}-${localPickup}`], stops: [newStop], updatedAt: new Date().toISOString() }]);
    }

    setLocalLoadOpen(false);
    resetLocalLoad();
    toast("Local load created", { description: `${refNumber} — ${localVins.length} car${localVins.length === 1 ? "" : "s"} · ${reasonLabels[localReason]}` });
  };

  const filteredLocations = (q: string) =>
    locationOptions.filter((l) => !q || l.code.includes(q.toUpperCase()) || l.name.toUpperCase().includes(q.toUpperCase()));

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cars</h1>
          <p className="text-muted-foreground text-sm mt-1">{cars.length} cars tracked</p>
        </div>
        <Button onClick={() => setLocalLoadOpen(true)}>
          <Truck className="mr-2 h-4 w-4" /> Local Load
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingCar} onOpenChange={(o) => !o && setEditingCar(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCar ? `${editingCar.year} ${editingCar.make} ${editingCar.model}` : "Edit Car"}
            </DialogTitle>
          </DialogHeader>
          {editingCar && (
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">VIN</p>
                <p className="font-mono text-sm">{editingCar.vin}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={(v) => setEditStatus(v as CarStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="at_shop">At Shop</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Driver</Label>
                  <Select value={editDriverId} onValueChange={setEditDriverId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {drivers.filter((d) => d.status === "active").map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Color</Label><Input name="color" defaultValue={editingCar.color || ""} /></div>
                <div><Label>Received Date</Label><Input name="receivedDate" type="date" defaultValue={editingCar.receivedDate || ""} /></div>
                <div><Label>Pickup Location</Label><Input name="pickupLocation" defaultValue={editingCar.pickupLocation || ""} placeholder="Where picked up from" /></div>
                {editStatus === "delivered" && (
                  <>
                    <div><Label>Delivered Date</Label><Input name="deliveredDate" type="date" defaultValue={editingCar.deliveredDate || ""} /></div>
                    <div className="sm:col-span-2"><Label>Delivery Location</Label><Input name="deliveryLocation" defaultValue={editingCar.deliveryLocation || ""} placeholder="Where delivered to" /></div>
                  </>
                )}
                <div className="sm:col-span-2"><Label>Notes</Label><Textarea name="notes" defaultValue={editingCar.notes || ""} rows={2} /></div>
              </div>
              <div className="flex justify-between gap-3">
                <Button type="button" variant="destructive" onClick={() => handleDelete(editingCar.id)}>Remove Car</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Status filter tabs + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {(["all", "at_shop", "in_transit", "delivered"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="gap-2"
            >
              {s === "all" ? "All" : statusConfig[s].label}
              <span className={`text-xs ${statusFilter === s ? "opacity-70" : "text-muted-foreground"}`}>
                {counts[s]}
              </span>
            </Button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by VIN (partial ok), make, model..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* At-shop alert — show on All and At Shop tabs */}
      {(statusFilter === "all" || statusFilter === "at_shop") && counts.at_shop > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{counts.at_shop}</strong> car{counts.at_shop === 1 ? "" : "s"} currently at shop.
            {(() => {
              const long = cars.filter((c) => (!c.status || c.status === "at_shop") && (getDwellDays(c) ?? 0) >= 3);
              return long.length > 0
                ? ` ${long.length} held 3+ days — these need attention.`
                : "";
            })()}
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CarIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {search || statusFilter !== "all" ? "No cars match your filters" : "No cars tracked yet"}
              </p>
              {!search && statusFilter === "all" && (
                <p className="text-xs text-muted-foreground mt-1">Add cars by VIN to start tracking movement.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>VIN</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Load</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pickup From</TableHead>
                  <TableHead>Delivered To</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead className="text-right">Dwell</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((car) => {
                  const carStatus = car.status || "at_shop";
                  const dwell = getDwellDays(car);
                  const driver = drivers.find((d) => d.id === car.driverId);
                  const isLong = carStatus === "at_shop" && (dwell ?? 0) >= 3;
                  return (
                    <TableRow
                      key={car.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEditOpen(car)}
                    >
                      <TableCell className="font-mono text-xs">{car.vin}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{car.year} {car.make} {car.model}</p>
                          {car.vehicleName && car.vehicleName !== `${car.make} ${car.model}` && (
                            <p className="text-xs text-muted-foreground">{car.vehicleName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {car.loadId ? (allLoads.find((l) => l.id === car.loadId)?.referenceNumber || car.loadId.slice(0, 6)) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusConfig[carStatus].badge}>
                          {statusConfig[carStatus].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{car.pickupLocation || "—"}</TableCell>
                      <TableCell className="text-sm">{car.deliveryLocation || "—"}</TableCell>
                      <TableCell className="text-sm tabular-nums">{car.deliveredDate || "—"}</TableCell>
                      <TableCell className="text-right">
                        {dwell !== null ? (
                          <Badge
                            variant="secondary"
                            className={
                              isLong ? "bg-red-100 text-red-700"
                              : dwell >= 1 ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                            }
                          >
                            {dwell} day{dwell === 1 ? "" : "s"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
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

      {/* Local Load Dialog */}
      <Dialog open={localLoadOpen} onOpenChange={(o) => { setLocalLoadOpen(o); if (!o) resetLocalLoad(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Local Load</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Single car or flatbed pickup — up to 4 cars. Creates a load, adds cars to inventory, and logs on the driver recap.</p>

          <div className="space-y-4">
            {/* Reason */}
            <div>
              <Label>Reason</Label>
              <Select value={localReason} onValueChange={setLocalReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging for truck</SelectItem>
                  <SelectItem value="auction">Auction</SelectItem>
                  <SelectItem value="customer_delivery">Customer delivery</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Driver */}
            <div>
              <Label>Driver</Label>
              <Select value={localDriverId} onValueChange={setLocalDriverId}>
                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  {drivers.filter((d) => d.status === "active").map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pickup location */}
            <div>
              <Label>Pickup From</Label>
              <div className="relative">
                <Input
                  value={localPickupSearch || localPickup}
                  onChange={(e) => { setLocalPickupSearch(e.target.value); if (!e.target.value) setLocalPickup(""); }}
                  onFocus={() => setLocalPickupSearch(localPickup)}
                  onBlur={() => setTimeout(() => setLocalPickupSearch(""), 150)}
                  placeholder="Search location..."
                />
                {localPickupSearch && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-lg max-h-40 overflow-y-auto">
                    {filteredLocations(localPickupSearch).map((l) => (
                      <button key={l.id} type="button" className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${localPickup === l.code ? "bg-muted" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); setLocalPickup(l.code); setLocalPickupSearch(""); }}>
                        <span className="font-medium">{l.code}</span> <span className="text-muted-foreground ml-1">{l.name}</span>
                      </button>
                    ))}
                    {localPickupSearch.trim().length > 0 && !locationOptions.some((l) => l.code === localPickupSearch.trim().toUpperCase()) && (
                      <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 text-primary"
                        onMouseDown={(e) => { e.preventDefault(); const c = handleCreateLocation(localPickupSearch); if (c) setLocalPickup(c); setLocalPickupSearch(""); }}>
                        <Plus className="inline h-3 w-3 mr-1" />Create "{localPickupSearch.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Delivery location */}
            <div>
              <Label>Delivering To</Label>
              <div className="relative">
                <Input
                  value={localDeliverySearch || localDelivery}
                  onChange={(e) => { setLocalDeliverySearch(e.target.value); if (!e.target.value) setLocalDelivery(""); }}
                  onFocus={() => setLocalDeliverySearch(localDelivery)}
                  onBlur={() => setTimeout(() => setLocalDeliverySearch(""), 150)}
                  placeholder="Defaults to SHOP"
                />
                {localDeliverySearch && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-lg max-h-40 overflow-y-auto">
                    {filteredLocations(localDeliverySearch).map((l) => (
                      <button key={l.id} type="button" className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${localDelivery === l.code ? "bg-muted" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); setLocalDelivery(l.code); setLocalDeliverySearch(""); }}>
                        <span className="font-medium">{l.code}</span> <span className="text-muted-foreground ml-1">{l.name}</span>
                      </button>
                    ))}
                    {localDeliverySearch.trim().length > 0 && !locationOptions.some((l) => l.code === localDeliverySearch.trim().toUpperCase()) && (
                      <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 text-primary"
                        onMouseDown={(e) => { e.preventDefault(); const c = handleCreateLocation(localDeliverySearch); if (c) setLocalDelivery(c); setLocalDeliverySearch(""); }}>
                        <Plus className="inline h-3 w-3 mr-1" />Create "{localDeliverySearch.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* VINs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cars (up to 4)</Label>
                {localVins.length > 0 && <Badge variant="secondary" className="bg-primary/10 text-primary">{localVins.length}/4</Badge>}
              </div>
              <div className="flex gap-2">
                <Input
                  value={localVinInput}
                  onChange={(e) => setLocalVinInput(e.target.value.toUpperCase())}
                  placeholder="Enter or paste VINs"
                  disabled={localVins.length >= 4}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLocalVin(); } }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted.includes("\n") || pasted.includes(",")) { e.preventDefault(); setLocalVinInput(pasted); setTimeout(handleAddLocalVin, 0); }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddLocalVin} disabled={localDecoding || !localVinInput.trim() || localVins.length >= 4}>
                  {localDecoding ? "..." : "Add"}
                </Button>
              </div>
              {localVins.map((pv) => (
                <div key={pv.tempId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="font-mono text-xs flex-1">{pv.vin}</span>
                  {pv.decoded ? (
                    <span className="text-muted-foreground">{pv.year} {pv.make} {pv.model}</span>
                  ) : (
                    <div className="flex gap-1">
                      <Input className="h-7 w-14 text-xs" placeholder="Year" value={pv.year}
                        onChange={(e) => setLocalVins((prev) => prev.map((v) => v.tempId === pv.tempId ? { ...v, year: e.target.value } : v))} />
                      <Input className="h-7 w-16 text-xs" placeholder="Make" value={pv.make}
                        onChange={(e) => setLocalVins((prev) => prev.map((v) => v.tempId === pv.tempId ? { ...v, make: e.target.value } : v))} />
                      <Input className="h-7 w-16 text-xs" placeholder="Model" value={pv.model}
                        onChange={(e) => setLocalVins((prev) => prev.map((v) => v.tempId === pv.tempId ? { ...v, model: e.target.value } : v))} />
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                    onClick={() => setLocalVins((prev) => prev.filter((v) => v.tempId !== pv.tempId))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={handleLocalLoadSubmit} disabled={localVins.length === 0 || !localDriverId}>
              Create Local Load ({localVins.length} car{localVins.length === 1 ? "" : "s"})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
