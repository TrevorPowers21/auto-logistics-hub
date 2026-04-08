import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useStoreData } from "@/hooks/use-store";
import { decodeVin } from "@/lib/vin";
import {
  generateId, getCars, saveCars, getDrivers, getLoads, saveLoads,
  getLocations, saveLocations, getDriverBoards, saveDriverBoards,
} from "@/lib/store";
import { Car, Load, LocationProfile } from "@/lib/types";
import { Plus, X } from "lucide-react";

type PendingVin = { tempId: string; vin: string; year: string; make: string; model: string; decoded: boolean };

export function LocalLoadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const drivers = useStoreData(getDrivers);
  const locations = useStoreData(getLocations);
  const allLoads = useStoreData(getLoads);

  const [localVins, setLocalVins] = useState<PendingVin[]>([]);
  const [localVinInput, setLocalVinInput] = useState("");
  const [localDecoding, setLocalDecoding] = useState(false);
  const [localDriverId, setLocalDriverId] = useState("");
  const [localPickup, setLocalPickup] = useState("");
  const [localDelivery, setLocalDelivery] = useState("");
  const [localReason, setLocalReason] = useState("staging");
  const [localPickupSearch, setLocalPickupSearch] = useState("");
  const [localDeliverySearch, setLocalDeliverySearch] = useState("");

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

  const filteredLocations = (q: string) =>
    locationOptions.filter((l) => !q || l.code.includes(q.toUpperCase()) || l.name.toUpperCase().includes(q.toUpperCase()));

  const reset = () => {
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
    const newEntries: PendingVin[] = [];
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

  const handleSubmit = () => {
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

    onOpenChange(false);
    reset();
    toast("Local load created", { description: `${refNumber} — ${localVins.length} car${localVins.length === 1 ? "" : "s"} · ${reasonLabels[localReason]}` });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Local Load</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Single car or flatbed pickup — up to 4 cars. Creates a load, adds cars to inventory, and logs on the driver recap.</p>

        <div className="space-y-4">
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

          <Button className="w-full" onClick={handleSubmit} disabled={localVins.length === 0 || !localDriverId}>
            Create Local Load ({localVins.length} car{localVins.length === 1 ? "" : "s"})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
