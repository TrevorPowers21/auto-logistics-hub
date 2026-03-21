import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useStoreData } from "@/hooks/use-store";
import { decodeVin } from "@/lib/vin";
import { getAppSetting, generateId, getDrivers, getVehicles, saveAppSetting, saveDrivers, saveVehicles } from "@/lib/store";
import { getSavedSamsaraToken, isSamsaraConfigured, samsaraStatTypes, syncSamsaraFleetData } from "@/lib/samsara";
import { FleetMaintenanceEntry, Vehicle } from "@/lib/types";
import { Plus, Save, Search } from "lucide-react";
import { Link } from "react-router-dom";

const statusBadge: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  maintenance: "bg-amber-100 text-amber-700",
  retired: "bg-gray-100 text-gray-600",
};

export default function VehiclesPage() {
  const vehicles = useStoreData(getVehicles);
  const drivers = useStoreData(getDrivers);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(() => getAppSetting("samsara_last_sync_at"));
  const [cursor, setCursor] = useState(() => getAppSetting("samsara_cursor"));
  const [apiToken, setApiToken] = useState("");
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [mileageInput, setMileageInput] = useState("");
  const [decodingVin, setDecodingVin] = useState(false);

  useEffect(() => {
    void getSavedSamsaraToken()
      .then((token) => setApiToken(token))
      .catch(() => setApiToken(""));
  }, []);

  const resetAddVehicleForm = () => {
    setVin("");
    setYear("");
    setMake("");
    setModel("");
    setLicensePlate("");
    setMileageInput("");
  };

  const handleDecodeVin = async () => {
    try {
      setDecodingVin(true);
      const decoded = await decodeVin(vin);
      setYear(String(decoded.year));
      setMake(decoded.make);
      setModel(decoded.model);
      toast("VIN decoded", {
        description: "Year, make, and model were filled in for this vehicle.",
      });
    } catch (error) {
      toast("VIN lookup failed", {
        description: error instanceof Error ? error.message : "Unable to decode VIN.",
      });
    } finally {
      setDecodingVin(false);
    }
  };

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newVehicle: Vehicle = {
      id: generateId(),
      year: Number(year),
      make: make.trim(),
      model: model.trim(),
      vin: vin.trim().toUpperCase(),
      licensePlate: licensePlate.trim(),
      status: "active",
      mileage: Number(mileageInput || 0),
      notes: "",
      maintenanceLog: [],
    };
    saveVehicles([...vehicles, newVehicle]);
    setOpen(false);
    resetAddVehicleForm();
  };

  const updateVehicle = (vehicleId: string, nextVehicle: Vehicle) => {
    saveVehicles(vehicles.map((vehicle) => vehicle.id === vehicleId ? nextVehicle : vehicle));
  };

  const removeVehicle = (vehicleId: string) => {
    saveVehicles(vehicles.filter((vehicle) => vehicle.id !== vehicleId));
  };

  const handleSamsaraSync = async () => {
    try {
      setSyncing(true);
      const synced = await syncSamsaraFleetData(vehicles, drivers, cursor || undefined);
      saveVehicles(synced.vehicles);
      saveDrivers(synced.drivers);

      if (synced.endCursor) {
        saveAppSetting("samsara_cursor", synced.endCursor);
        setCursor(synced.endCursor);
      }

      const syncedAt = new Date().toISOString();
      saveAppSetting("samsara_last_sync_at", syncedAt);
      setLastSyncAt(syncedAt);

      toast("Samsara sync complete", {
        description: [
          `${synced.updatedVehicleCount} vehicles updated`,
          `${synced.importedVehicleCount} vehicles imported`,
          `${synced.updatedDriverCount} drivers updated`,
          `${synced.importedDriverCount} drivers imported`,
        ].join(" • "),
      });
    } catch (error) {
      toast("Samsara sync failed", {
        description: error instanceof Error ? error.message : "Unknown Samsara sync error.",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet</h1>
          <p className="text-muted-foreground text-sm mt-1">{vehicles.length} units tracked</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Vehicle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <Label>VIN</Label>
                  <Input
                    value={vin}
                    onChange={(event) => setVin(event.target.value.toUpperCase())}
                    placeholder="Enter VIN"
                    required
                  />
                </div>
                <div className="self-end">
                  <Button type="button" variant="outline" onClick={handleDecodeVin} disabled={decodingVin}>
                    <Search className="mr-2 h-4 w-4" />
                    {decodingVin ? "Decoding..." : "Decode VIN"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Year</Label><Input value={year} onChange={(event) => setYear(event.target.value)} required /></div>
                <div><Label>Make</Label><Input value={make} onChange={(event) => setMake(event.target.value)} required /></div>
                <div><Label>Model</Label><Input value={model} onChange={(event) => setModel(event.target.value)} required /></div>
                <div><Label>License Plate</Label><Input value={licensePlate} onChange={(event) => setLicensePlate(event.target.value)} required /></div>
                <div><Label>Mileage</Label><Input value={mileageInput} onChange={(event) => setMileageInput(event.target.value)} inputMode="numeric" /></div>
              </div>
              <Button type="submit" className="w-full">Save Vehicle</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Samsara Fleet Sync</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Pulls {samsaraStatTypes.join(", ")} from the official vehicle stats feed into Fleet.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/settings">API Settings</Link>
            </Button>
            <Button onClick={handleSamsaraSync} disabled={!isSamsaraConfigured(apiToken) || syncing}>
              {syncing ? "Syncing..." : "Sync Samsara Feed"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Connection</p>
            <p className="mt-2 text-sm">
              {isSamsaraConfigured(apiToken) ? "Configured and ready to sync" : "Add a Samsara token in Settings"}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Last Sync</p>
            <p className="mt-2 text-sm">{lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Not synced yet"}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Feed Cursor</p>
            <p className="mt-2 break-all text-sm">{cursor || "No cursor saved yet"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fleet Unit</TableHead>
                <TableHead>VIN</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Mileage</TableHead>
                <TableHead>Assigned Driver</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => {
                const driver = drivers.find((item) => item.id === vehicle.assignedDriverId);
                return (
                  <FleetUnitRow
                    key={vehicle.id}
                    vehicle={vehicle}
                    driverName={driver?.name || "—"}
                    onSave={updateVehicle}
                    onRemove={removeVehicle}
                  />
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FleetUnitRow({
  vehicle,
  driverName,
  onSave,
  onRemove,
}: {
  vehicle: Vehicle;
  driverName: string;
  onSave: (vehicleId: string, nextVehicle: Vehicle) => void;
  onRemove: (vehicleId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(String(vehicle.year));
  const [make, setMake] = useState(vehicle.make);
  const [model, setModel] = useState(vehicle.model);
  const [vin, setVin] = useState(vehicle.vin);
  const [licensePlate, setLicensePlate] = useState(vehicle.licensePlate);
  const [mileage, setMileage] = useState(String(vehicle.mileage || 0));
  const [notes, setNotes] = useState(vehicle.notes || "");
  const [status, setStatus] = useState<Vehicle["status"]>(vehicle.status);
  const [externalId, setExternalId] = useState(vehicle.externalId || "");
  const [maintenanceLog, setMaintenanceLog] = useState<FleetMaintenanceEntry[]>(vehicle.maintenanceLog || []);

  useEffect(() => {
    setYear(String(vehicle.year));
    setMake(vehicle.make);
    setModel(vehicle.model);
    setVin(vehicle.vin);
    setLicensePlate(vehicle.licensePlate);
    setMileage(String(vehicle.mileage || 0));
    setNotes(vehicle.notes || "");
    setStatus(vehicle.status);
    setExternalId(vehicle.externalId || "");
    setMaintenanceLog(vehicle.maintenanceLog || []);
  }, [vehicle]);

  const addMaintenanceItem = () => {
    setMaintenanceLog((current) => [
      ...current,
      { id: generateId(), date: "", type: "", mileage: Number(mileage) || 0, details: "" },
    ]);
  };

  const updateMaintenanceItem = (id: string, patch: Partial<FleetMaintenanceEntry>) => {
    setMaintenanceLog((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const removeMaintenanceItem = (id: string) => {
    setMaintenanceLog((current) => current.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    onSave(vehicle.id, {
      ...vehicle,
      year: Number(year) || vehicle.year,
      make: make.trim(),
      model: model.trim(),
      vin: vin.trim().toUpperCase(),
      licensePlate: licensePlate.trim(),
      mileage: Number(mileage) || 0,
      notes: notes.trim(),
      status,
      externalSource: externalId.trim() ? "samsara" : vehicle.externalSource,
      externalId: externalId.trim() || undefined,
      maintenanceLog: maintenanceLog.map((item) => ({
        ...item,
        type: item.type.trim(),
        details: item.details.trim(),
      })).filter((item) => item.date || item.type || item.details),
    });
    setOpen(false);
  };

  const handleRemove = () => {
    onRemove(vehicle.id);
    setOpen(false);
    toast("Vehicle removed", {
      description: `${vehicle.year} ${vehicle.make} ${vehicle.model} was removed from Fleet.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TableRow
        className="group cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        tabIndex={0}
      >
        <TableCell className="font-medium">
          <span className="underline-offset-4 group-hover:underline">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </span>
        </TableCell>
        <TableCell className="font-mono text-sm">{vehicle.vin}</TableCell>
        <TableCell className="text-sm">{vehicle.licensePlate}</TableCell>
        <TableCell className="tabular-nums">{(vehicle.mileage || 0).toLocaleString()}</TableCell>
        <TableCell className="text-sm">{driverName}</TableCell>
        <TableCell>
          <Badge variant="secondary" className={statusBadge[vehicle.status]}>{vehicle.status}</Badge>
        </TableCell>
      </TableRow>
      <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{vehicle.year} {vehicle.make} {vehicle.model}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input value={year} onChange={(event) => setYear(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Make</Label>
                  <Input value={make} onChange={(event) => setMake(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input value={model} onChange={(event) => setModel(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as Vehicle["status"])}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="active">active</option>
                    <option value="maintenance">maintenance</option>
                    <option value="retired">retired</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Mileage</Label>
                  <Input value={mileage} onChange={(event) => setMileage(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>VIN</Label>
                  <Input value={vin} onChange={(event) => setVin(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>License Plate</Label>
                  <Input value={licensePlate} onChange={(event) => setLicensePlate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Samsara Vehicle ID</Label>
                  <Input
                    value={externalId}
                    onChange={(event) => setExternalId(event.target.value)}
                    placeholder="Optional, for direct Samsara matching"
                  />
                </div>
              </div>

              {(vehicle.lastKnownLocation || vehicle.engineState || vehicle.lastSyncedAt) ? (
                <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Engine</p>
                    <p className="mt-2 text-sm">{vehicle.engineState || "No engine state synced"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Last Location</p>
                    <p className="mt-2 text-sm">{vehicle.lastKnownLocation || "No GPS location synced"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Synced</p>
                    <p className="mt-2 text-sm">{vehicle.lastSyncedAt ? new Date(vehicle.lastSyncedAt).toLocaleString() : "Not synced yet"}</p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Vehicle Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="General notes, known issues, downtime, etc."
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Maintenance / Fixes</h3>
                  <Button variant="outline" onClick={addMaintenanceItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Entry
                  </Button>
                </div>

                <div className="space-y-3">
                  {maintenanceLog.length > 0 ? maintenanceLog.map((item) => (
                    <div key={item.id} className="rounded-lg border p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={item.date}
                            onChange={(event) => updateMaintenanceItem(item.id, { date: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Input
                            value={item.type}
                            onChange={(event) => updateMaintenanceItem(item.id, { type: event.target.value })}
                            placeholder="Oil change, brake fix, repair..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Mileage</Label>
                          <Input
                            type="number"
                            value={String(item.mileage)}
                            onChange={(event) => updateMaintenanceItem(item.id, { mileage: Number(event.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <Label>Details</Label>
                        <Textarea
                          value={item.details}
                          onChange={(event) => updateMaintenanceItem(item.id, { details: event.target.value })}
                          rows={2}
                          placeholder="What was fixed, what issue showed up, what still needs work..."
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => removeMaintenanceItem(item.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No maintenance history logged yet.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="destructive" onClick={handleRemove}>
                  Remove Vehicle
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Fleet Details
                </Button>
              </div>
            </div>
      </DialogContent>
    </Dialog>
  );
}
