import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getExpenses, saveExpenses, getDrivers, getVehicles, generateId } from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { Expense, ExpenseCategory } from "@/lib/types";
import { Plus, Search, Filter, Receipt } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const categories: ExpenseCategory[] = ["fuel", "maintenance", "tolls", "insurance", "misc"];

const catColors: Record<ExpenseCategory, string> = {
  fuel: "hsl(217, 72%, 30%)",
  maintenance: "hsl(199, 89%, 40%)",
  tolls: "hsl(38, 92%, 50%)",
  insurance: "hsl(152, 60%, 36%)",
  misc: "hsl(215, 16%, 47%)",
};

const catBadge: Record<ExpenseCategory, string> = {
  fuel: "bg-blue-100 text-blue-700",
  maintenance: "bg-sky-100 text-sky-700",
  tolls: "bg-amber-100 text-amber-700",
  insurance: "bg-emerald-100 text-emerald-700",
  misc: "bg-gray-100 text-gray-600",
};

export default function ExpensesPage() {
  const expenses = useStoreData(getExpenses);
  const drivers = useStoreData(getDrivers);
  const vehicles = useStoreData(getVehicles);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);

  // Controlled state for selects (FormData doesn't capture shadcn Select values)
  const [newCategory, setNewCategory] = useState<ExpenseCategory>("fuel");
  const [newDriverId, setNewDriverId] = useState("");
  const [newVehicleId, setNewVehicleId] = useState("");

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setNewCategory("fuel");
      setNewDriverId("");
      setNewVehicleId("");
    }
  };

  const filtered = expenses
    .filter((e) => {
      const matchSearch = e.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === "all" || e.category === catFilter;
      return matchSearch && matchCat;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const breakdownData = categories
    .map((c) => ({
      name: c,
      value: expenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0),
    }))
    .filter((d) => d.value > 0);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newExpense: Expense = {
      id: generateId(),
      date: fd.get("date") as string,
      category: newCategory,
      amount: Number(fd.get("amount")),
      description: fd.get("description") as string,
      driverId: newDriverId || undefined,
      vehicleId: newVehicleId || undefined,
    };
    saveExpenses([...expenses, newExpense]);
    handleOpenChange(false);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">Total: ${total.toLocaleString()}</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Log Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log New Expense</DialogTitle>
            </DialogHeader>
            <form key={open ? "open" : "closed"} onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Date</Label>
                  <Input
                    name="date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={newCategory} onValueChange={(v) => setNewCategory(v as ExpenseCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount ($)</Label>
                  <Input name="amount" type="number" step="0.01" min="0" required />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input name="description" required />
                </div>
                <div>
                  <Label>Driver</Label>
                  <Select value={newDriverId} onValueChange={setNewDriverId}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vehicle</Label>
                  <Select value={newVehicleId} onValueChange={setNewVehicleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.year} {v.make} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">
                Save Expense
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdownData.length === 0 ? (
              <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                No expenses yet
              </div>
            ) : (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdownData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {breakdownData.map((d) => (
                          <Cell key={d.name} fill={catColors[d.name as ExpenseCategory]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {breakdownData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ background: catColors[d.name as ExpenseCategory] }}
                        />
                        <span className="capitalize">{d.name}</span>
                      </div>
                      <span className="tabular-nums font-medium">${d.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-3.5 w-3.5 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Receipt className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {search || catFilter !== "all" ? "No expenses match your filters" : "No expenses logged yet"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e) => {
                      const driver = drivers.find((d) => d.id === e.driverId);
                      const vehicle = vehicles.find((v) => v.id === e.vehicleId);
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="tabular-nums text-sm">{e.date}</TableCell>
                          <TableCell className="font-medium">{e.description}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`capitalize ${catBadge[e.category]}`}>
                              {e.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{driver?.name || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {vehicle ? `${vehicle.year} ${vehicle.make}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            ${e.amount.toLocaleString()}
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
      </div>
    </div>
  );
}
