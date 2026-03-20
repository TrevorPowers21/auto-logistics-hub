import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getVehicles, saveVehicles, getDrivers, generateId } from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { Vehicle } from "@/lib/types";
import { Plus } from "lucide-react";

const statusBadge: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  maintenance: "bg-amber-100 text-amber-700",
  retired: "bg-gray-100 text-gray-600",
};

export default function VehiclesPage() {
  const vehicles = useStoreData(getVehicles);
  const drivers = useStoreData(getDrivers);
  const [open, setOpen] = useState(false);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newVehicle: Vehicle = {
      id: generateId(),
      year: Number(fd.get("year")),
      make: fd.get("make") as string,
      model: fd.get("model") as string,
      vin: fd.get("vin") as string,
      licensePlate: fd.get("plate") as string,
      status: "active",
    };
    saveVehicles([...vehicles, newVehicle]);
    setOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehicles</h1>
          <p className="text-muted-foreground text-sm mt-1">{vehicles.length} in fleet</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Vehicle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Year</Label><Input name="year" type="number" required /></div>
                <div><Label>Make</Label><Input name="make" required /></div>
                <div><Label>Model</Label><Input name="model" required /></div>
                <div><Label>VIN</Label><Input name="vin" required /></div>
                <div><Label>License Plate</Label><Input name="plate" required /></div>
              </div>
              <Button type="submit" className="w-full">Save Vehicle</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>VIN</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Assigned Driver</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => {
                const driver = drivers.find((d) => d.id === v.assignedDriverId);
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.year} {v.make} {v.model}</TableCell>
                    <TableCell className="font-mono text-sm">{v.vin}</TableCell>
                    <TableCell className="text-sm">{v.licensePlate}</TableCell>
                    <TableCell className="text-sm">{driver?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusBadge[v.status]}>{v.status}</Badge>
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
