import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDrivers, getLoads, getExpenses, getInvoices } from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { Truck, Users, DollarSign, FileText, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const statusColor: Record<string, string> = {
  booked: "bg-blue-100 text-blue-700",
  dispatched: "bg-amber-100 text-amber-700",
  in_transit: "bg-purple-100 text-purple-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function Dashboard() {
  const drivers = useStoreData(getDrivers);
  const loads = useStoreData(getLoads);
  const expenses = useStoreData(getExpenses);
  const invoices = useStoreData(getInvoices);

  const activeDrivers = drivers.filter((d) => d.status === "active").length;
  const activeLoads = loads.filter((l) => ["booked", "dispatched", "in_transit"].includes(l.status)).length;
  const monthExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const outstandingInvoices = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  const chartData = [
    { name: "Revenue", value: totalRevenue },
    { name: "Expenses", value: monthExpenses },
    { name: "Outstanding", value: outstandingInvoices },
  ];

  const recentLoads = [...loads].sort((a, b) => b.pickupDate.localeCompare(a.pickupDate)).slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Fleet overview for March 2026</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Truck} label="Active Loads" value={activeLoads} accent="text-primary" />
        <SummaryCard icon={Users} label="Active Drivers" value={activeDrivers} accent="text-primary" />
        <SummaryCard icon={DollarSign} label="Monthly Expenses" value={`$${monthExpenses.toLocaleString()}`} accent="text-destructive" direction="down" />
        <SummaryCard icon={FileText} label="Outstanding" value={`$${outstandingInvoices.toLocaleString()}`} accent="text-amber-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent Loads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLoads.map((load) => (
                <div key={load.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{load.referenceNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {load.pickupLocation} → {load.deliveryLocation}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium tabular-nums">${load.price.toLocaleString()}</span>
                    <Badge variant="secondary" className={`text-xs ${statusColor[load.status] || ""}`}>
                      {load.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent, direction }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
  direction?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className={`rounded-lg p-2 bg-muted ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          {direction === "down" ? (
            <ArrowDownRight className="h-4 w-4 text-destructive" />
          ) : direction === "up" ? (
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          ) : null}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
