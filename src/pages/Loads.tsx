import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getLoads, saveLoads, getDrivers, generateId } from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { Load, LoadStatus } from "@/lib/types";
import { Plus, Search, Filter, Truck } from "lucide-react";

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

export default function LoadsPage() {
  const loads = useStoreData(getLoads);
  const drivers = useStoreData(getDrivers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [newDriverId, setNewDriverId] = useState("");

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setNewDriverId("");
  };

  const filtered = loads.filter((l) => {
    const matchSearch =
      l.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      l.customer.toLowerCase().includes(search.toLowerCase()) ||
      l.pickupLocation.toLowerCase().includes(search.toLowerCase()) ||
      l.deliveryLocation.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newLoad: Load = {
      id: generateId(),
      referenceNumber: `LD-${new Date().getFullYear()}-${String(loads.length + 154).padStart(4, "0")}`,
      customer: fd.get("customer") as string,
      customerPhone: fd.get("customerPhone") as string,
      pickupLocation: fd.get("pickup") as string,
      deliveryLocation: fd.get("delivery") as string,
      pickupDate: fd.get("pickupDate") as string,
      deliveryDate: fd.get("deliveryDate") as string,
      vehicleInfo: fd.get("vehicleInfo") as string,
      status: "booked",
      driverId: newDriverId || undefined,
      price: Number(fd.get("price")),
      notes: fd.get("notes") as string,
    };
    saveLoads([...loads, newLoad]);
    handleOpenChange(false);
  };

  const updateStatus = (id: string, status: LoadStatus) => {
    saveLoads(loads.map((l) => (l.id === id ? { ...l, status } : l)));
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
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New Load
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Load</DialogTitle>
            </DialogHeader>
            <form key={open ? "open" : "closed"} onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Customer</Label>
                  <Input name="customer" required />
                </div>
                <div>
                  <Label>Customer Phone</Label>
                  <Input name="customerPhone" />
                </div>
                <div>
                  <Label>Pickup Location</Label>
                  <Input name="pickup" required />
                </div>
                <div>
                  <Label>Delivery Location</Label>
                  <Input name="delivery" required />
                </div>
                <div>
                  <Label>Pickup Date</Label>
                  <Input name="pickupDate" type="date" required />
                </div>
                <div>
                  <Label>Delivery Date</Label>
                  <Input name="deliveryDate" type="date" required />
                </div>
                <div>
                  <Label>Vehicle Info</Label>
                  <Input name="vehicleInfo" required />
                </div>
                <div>
                  <Label>Price ($)</Label>
                  <Input name="price" type="number" required />
                </div>
                <div className="sm:col-span-2">
                  <Label>Assign Driver</Label>
                  <Select value={newDriverId} onValueChange={setNewDriverId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.filter((d) => d.status === "active").map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea name="notes" rows={2} />
              </div>
              <Button type="submit" className="w-full">
                Create Load
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search loads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusLabels.map((s) => (
              <SelectItem key={s} value={s}>
                {formatStatus(s)}
              </SelectItem>
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
                  <TableHead>Driver</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const driver = drivers.find((d) => d.id === l.driverId);
                  const nextStatus: Record<string, LoadStatus> = {
                    booked: "dispatched",
                    dispatched: "in_transit",
                    in_transit: "delivered",
                  };
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-sm">{l.referenceNumber}</TableCell>
                      <TableCell className="font-medium">{l.customer}</TableCell>
                      <TableCell className="text-sm">
                        {l.pickupLocation} → {l.deliveryLocation}
                      </TableCell>
                      <TableCell className="text-sm">{driver?.name || "—"}</TableCell>
                      <TableCell className="text-sm tabular-nums">{l.pickupDate}</TableCell>
                      <TableCell className="tabular-nums font-medium">${l.price.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColor[l.status]}>
                          {formatStatus(l.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {nextStatus[l.status] && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(l.id, nextStatus[l.status])}
                            >
                              → {formatStatus(nextStatus[l.status])}
                            </Button>
                          )}
                          {l.status !== "delivered" && l.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => updateStatus(l.id, "cancelled")}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
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
