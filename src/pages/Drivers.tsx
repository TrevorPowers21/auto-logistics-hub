import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDrivers, saveDrivers, generateId, getVehicles } from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { Driver, DriverStatus } from "@/lib/types";
import { toast } from "@/components/ui/sonner";
import { Plus, Search, Users } from "lucide-react";

const statusBadge: Record<DriverStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-600",
  on_leave: "bg-amber-100 text-amber-700",
};

const statusLabel: Record<DriverStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On Leave",
};

export default function DriversPage() {
  const drivers = useStoreData(getDrivers);
  const vehicles = useStoreData(getVehicles);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editStatus, setEditStatus] = useState<DriverStatus>("active");

  const activeDrivers = drivers.filter((d) => d.status !== "inactive");
  const inactiveDrivers = drivers.filter((d) => d.status === "inactive");

  const filtered = activeDrivers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search),
  );

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newDriver: Driver = {
      id: generateId(),
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      email: fd.get("email") as string,
      licenseNumber: fd.get("license") as string,
      licenseExpiry: fd.get("licenseExpiry") as string,
      status: "active",
      hireDate: new Date().toISOString().split("T")[0],
      totalMiles: 0,
      totalEarnings: 0,
      payRatePerCar: fd.get("payRatePerCar") ? Number(fd.get("payRatePerCar")) : undefined,
    };
    saveDrivers([...drivers, newDriver]);
    setAddOpen(false);
  };

  const handleEditOpen = (driver: Driver) => {
    setEditingDriver(driver);
    setEditStatus(driver.status);
  };

  const handleEditSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDriver) return;
    const fd = new FormData(e.currentTarget);
    const updated: Driver = {
      ...editingDriver,
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      email: fd.get("email") as string,
      licenseNumber: fd.get("license") as string,
      licenseExpiry: fd.get("licenseExpiry") as string,
      status: editStatus,
      payRatePerCar: fd.get("payRatePerCar") ? Number(fd.get("payRatePerCar")) : undefined,
    };
    saveDrivers(drivers.map((d) => (d.id === editingDriver.id ? updated : d)));
    setEditingDriver(null);
  };

  const handleMarkInactive = (id: string) => {
    saveDrivers(drivers.map((d) => (d.id === id ? { ...d, status: "inactive" as DriverStatus } : d)));
    setEditingDriver(null);
    toast("Driver marked inactive", { description: "Driver has been moved to inactive status. Historical data is preserved." });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
          <p className="text-muted-foreground text-sm mt-1">{drivers.length} total drivers</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Add Driver
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Driver</DialogTitle>
            </DialogHeader>
            <form key="add" onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Full Name</Label>
                  <Input name="name" required />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" required />
                </div>
                <div>
                  <Label>License #</Label>
                  <Input name="license" required />
                </div>
                <div>
                  <Label>License Expiry</Label>
                  <Input name="licenseExpiry" type="date" required />
                </div>
                <div>
                  <Label>Pay Rate ($/car)</Label>
                  <Input name="payRatePerCar" type="number" step="0.01" min="0" placeholder="e.g. 25.00" />
                </div>
              </div>
              <Button type="submit" className="w-full">
                Save Driver
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Driver Dialog */}
      <Dialog open={!!editingDriver} onOpenChange={(open) => !open && setEditingDriver(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
          </DialogHeader>
          {editingDriver && (
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Full Name</Label>
                  <Input name="name" defaultValue={editingDriver.name} required />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={editingDriver.phone} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={editingDriver.email} required />
                </div>
                <div>
                  <Label>License #</Label>
                  <Input name="license" defaultValue={editingDriver.licenseNumber} required />
                </div>
                <div>
                  <Label>License Expiry</Label>
                  <Input name="licenseExpiry" type="date" defaultValue={editingDriver.licenseExpiry} required />
                </div>
                <div>
                  <Label>Pay Rate ($/car)</Label>
                  <Input name="payRatePerCar" type="number" step="0.01" min="0" defaultValue={editingDriver.payRatePerCar ?? ""} placeholder="e.g. 25.00" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={(v) => setEditStatus(v as DriverStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-between gap-3">
                {editingDriver.status !== "inactive" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleMarkInactive(editingDriver.id)}
                  >
                    Mark Inactive
                  </Button>
                )}
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search drivers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? "No drivers match your search" : "No drivers yet"}
              </p>
              {!search && (
                <p className="text-xs text-muted-foreground mt-1">Add your first driver to get started.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Miles</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Pay Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => {
                  const vehicle = vehicles.find((v) => v.id === d.assignedVehicleId);
                  return (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEditOpen(d)}
                    >
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm">{d.phone}</TableCell>
                      <TableCell className="text-sm font-mono">{d.licenseNumber}</TableCell>
                      <TableCell className="text-sm">
                        {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{d.totalMiles.toLocaleString()}</TableCell>
                      <TableCell className="tabular-nums">${d.totalEarnings.toLocaleString()}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {d.payRatePerCar !== undefined ? `$${d.payRatePerCar}/car` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusBadge[d.status]}>
                          {statusLabel[d.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inactive drivers */}
      {inactiveDrivers.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
            <span className="text-xs">&#9654;</span>
            <span className="group-open:hidden">Show {inactiveDrivers.length} inactive driver{inactiveDrivers.length === 1 ? "" : "s"}</span>
            <span className="hidden group-open:inline">Hide inactive drivers</span>
          </summary>
          <Card className="mt-3 opacity-70">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Miles</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveDrivers.map((d) => (
                    <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEditOpen(d)}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm">{d.phone}</TableCell>
                      <TableCell className="tabular-nums">{d.totalMiles.toLocaleString()}</TableCell>
                      <TableCell className="tabular-nums">${d.totalEarnings.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">Inactive</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  );
}
