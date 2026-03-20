import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Search } from "lucide-react";

const statusBadge: Record<DriverStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-600",
  on_leave: "bg-amber-100 text-amber-700",
};

export default function DriversPage() {
  const drivers = useStoreData(getDrivers);
  const vehicles = useStoreData(getVehicles);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = drivers.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.phone.includes(search)
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
    };
    saveDrivers([...drivers, newDriver]);
    setOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
          <p className="text-muted-foreground text-sm mt-1">{drivers.length} total drivers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Driver</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Driver</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Full Name</Label><Input name="name" required /></div>
                <div><Label>Phone</Label><Input name="phone" required /></div>
                <div><Label>Email</Label><Input name="email" type="email" required /></div>
                <div><Label>License #</Label><Input name="license" required /></div>
                <div><Label>License Expiry</Label><Input name="licenseExpiry" type="date" required /></div>
              </div>
              <Button type="submit" className="w-full">Save Driver</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search drivers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Miles</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const vehicle = vehicles.find((v) => v.id === d.assignedVehicleId);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-sm">{d.phone}</TableCell>
                    <TableCell className="text-sm font-mono">{d.licenseNumber}</TableCell>
                    <TableCell className="text-sm">{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "—"}</TableCell>
                    <TableCell className="tabular-nums">{d.totalMiles.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">${d.totalEarnings.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusBadge[d.status]}>
                        {d.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
