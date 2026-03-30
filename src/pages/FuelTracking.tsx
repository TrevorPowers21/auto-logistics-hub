import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getFuelEntries, saveFuelEntries, generateId } from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { FuelEntry } from "@/lib/types";
import { Fuel, Plus } from "lucide-react";

export default function FuelTrackingPage() {
  const entries = useStoreData(getFuelEntries);
  const [open, setOpen] = useState(false);

  const sorted = useMemo(() =>
    [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  // Aggregate stats
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    const weekStr = thisWeekStart.toISOString().split("T")[0];

    const monthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
    const weekEntries = entries.filter((e) => e.date >= weekStr);

    return {
      totalGallons: entries.reduce((s, e) => s + e.gallons, 0),
      totalCost: entries.reduce((s, e) => s + e.totalCost, 0),
      monthGallons: monthEntries.reduce((s, e) => s + e.gallons, 0),
      monthCost: monthEntries.reduce((s, e) => s + e.totalCost, 0),
      weekGallons: weekEntries.reduce((s, e) => s + e.gallons, 0),
      weekCost: weekEntries.reduce((s, e) => s + e.totalCost, 0),
    };
  }, [entries]);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const gallons = Number(fd.get("gallons"));
    const costPerGallon = Number(fd.get("costPerGallon"));
    const entry: FuelEntry = {
      id: generateId(),
      date: fd.get("date") as string,
      gallons,
      costPerGallon,
      totalCost: Math.round(gallons * costPerGallon * 100) / 100,
      source: "yard",
      location: fd.get("location") as string || "Hudson View Oil",
      notes: fd.get("notes") as string || undefined,
    };
    saveFuelEntries([...entries, entry]);
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    saveFuelEntries(entries.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fuel Tracking</h1>
          <p className="text-muted-foreground text-sm mt-1">Yard fuel purchases — Hudson View Oil</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Log Fill</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Yard Fuel Fill</DialogTitle></DialogHeader>
            <form key={open ? "open" : "closed"} onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Date</Label>
                  <Input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                </div>
                <div>
                  <Label>Gallons</Label>
                  <Input name="gallons" type="number" step="0.1" min="0" required placeholder="e.g. 250" />
                </div>
                <div>
                  <Label>Cost per Gallon ($)</Label>
                  <Input name="costPerGallon" type="number" step="0.001" min="0" required placeholder="e.g. 3.45" />
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Input name="location" defaultValue="Hudson View Oil" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea name="notes" rows={2} placeholder="Invoice #, delivery notes, etc." />
                </div>
              </div>
              <Button type="submit" className="w-full">Save Fill</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">This Week</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{stats.weekGallons.toLocaleString()} gal</p>
            <p className="text-sm text-muted-foreground">${stats.weekCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">This Month</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{stats.monthGallons.toLocaleString()} gal</p>
            <p className="text-sm text-muted-foreground">${stats.monthCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">All Time</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{stats.totalGallons.toLocaleString()} gal</p>
            <p className="text-sm text-muted-foreground">${stats.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Future Fleet One integration note */}
      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Fuel className="h-4 w-4 shrink-0" />
        <span>
          <strong>Fleet One</strong> fuel card integration (road drivers) is planned for a future update.
          Road fuel expenses can be logged manually in the Expenses page for now.
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Fuel className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No fuel fills logged yet</p>
              <p className="text-xs text-muted-foreground mt-1">Log yard fuel purchases to track gallons and costs.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Gallons</TableHead>
                  <TableHead className="text-right">$/Gal</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="tabular-nums text-sm">{entry.date}</TableCell>
                    <TableCell className="text-sm">{entry.location || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{entry.gallons.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">${entry.costPerGallon.toFixed(3)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">${entry.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{entry.notes || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                        ×
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
