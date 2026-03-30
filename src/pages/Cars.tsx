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
import { generateId, getCars, saveCars, getDrivers } from "@/lib/store";
import { Car, CarStatus } from "@/lib/types";
import { AlertCircle, Car as CarIcon, Plus, Search } from "lucide-react";

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
  const [statusFilter, setStatusFilter] = useState<CarStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
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

  // Edit form state
  const [editStatus, setEditStatus] = useState<CarStatus>("at_shop");
  const [editDriverId, setEditDriverId] = useState("");

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
        // Primary sort: most recently delivered first (daily pay reconciliation)
        // Cars with delivery dates surface at top; at-shop sorted by dwell time
        const aDelivered = a.deliveredDate || "";
        const bDelivered = b.deliveredDate || "";
        if (aDelivered && bDelivered) return bDelivered.localeCompare(aDelivered);
        if (aDelivered && !bDelivered) return -1;
        if (!aDelivered && bDelivered) return 1;
        // Neither delivered — sort at-shop by dwell time desc, then in-transit by received desc
        const aStatus = a.status || "at_shop";
        const bStatus = b.status || "at_shop";
        if (aStatus === bStatus) {
          if (aStatus === "at_shop") {
            return (getDwellDays(b) ?? 0) - (getDwellDays(a) ?? 0);
          }
          return (b.receivedDate || "").localeCompare(a.receivedDate || "");
        }
        const order: Record<CarStatus, number> = { at_shop: 0, in_transit: 1, delivered: 2 };
        return order[aStatus] - order[bStatus];
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

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cars</h1>
          <p className="text-muted-foreground text-sm mt-1">{cars.length} cars tracked</p>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Car</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Add Car</DialogTitle></DialogHeader>
            <form onSubmit={handleAddCar} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <Label>VIN</Label>
                  <Input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="Enter VIN" required />
                </div>
                <div className="self-end">
                  <Button type="button" variant="outline" onClick={handleDecodeVin} disabled={decoding || !vin.trim()}>
                    <Search className="mr-2 h-4 w-4" />
                    {decoding ? "Decoding..." : "Decode VIN"}
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Year</Label><Input value={year} onChange={(e) => setYear(e.target.value)} required /></div>
                <div><Label>Make</Label><Input value={make} onChange={(e) => setMake(e.target.value)} required /></div>
                <div><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} required /></div>
                <div><Label>Vehicle Name</Label><Input value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} /></div>
                <div><Label>Color</Label><Input value={color} onChange={(e) => setColor(e.target.value)} /></div>
                <div><Label>Received Date</Label><Input name="receivedDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} /></div>
                <div className="sm:col-span-2"><Label>Pickup Location</Label><Input name="pickupLocation" placeholder="Where was this car picked up from?" /></div>
                <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
              </div>
              <Button type="submit" className="w-full">Save Car</Button>
            </form>
          </DialogContent>
        </Dialog>
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

      {/* At-shop alert */}
      {statusFilter === "all" && counts.at_shop > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{counts.at_shop}</strong> car{counts.at_shop === 1 ? "" : "s"} currently at shop.
            {(() => {
              const long = cars.filter((c) => (!c.status || c.status === "at_shop") && (getDwellDays(c) ?? 0) >= 3);
              return long.length > 0
                ? ` ${long.length} held 3+ days.`
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
                  <TableHead>Color</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pickup From</TableHead>
                  <TableHead>Delivered To</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Driver</TableHead>
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
                      <TableCell className="text-sm">{car.color || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusConfig[carStatus].badge}>
                          {statusConfig[carStatus].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{car.pickupLocation || "—"}</TableCell>
                      <TableCell className="text-sm">{car.deliveryLocation || "—"}</TableCell>
                      <TableCell className="text-sm tabular-nums">{car.deliveredDate || "—"}</TableCell>
                      <TableCell className="text-sm">{driver?.name || "—"}</TableCell>
                      <TableCell className="text-right">
                        {dwell !== null ? (
                          <span className={`text-sm tabular-nums font-medium ${isLong ? "text-amber-600" : ""}`}>
                            {dwell}d{isLong && " ⚠"}
                          </span>
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
    </div>
  );
}
