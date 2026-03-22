import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDrivers, getLoads, getExpenses, getInvoices, getVehicles } from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { Truck, Users, DollarSign, FileText, ArrowUpRight, ArrowDownRight, Gauge, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

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
  const vehicles = useStoreData(getVehicles);

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
  const trackedVehicles = vehicles.filter((vehicle) =>
    typeof vehicle.lastKnownLatitude === "number" && typeof vehicle.lastKnownLongitude === "number",
  );
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

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)]">
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Fleet GPS Tracker</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Live Samsara coordinates from the most recent fleet sync.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                <MapPinned className="h-3.5 w-3.5" />
                {trackedVehicles.length} tracked
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {trackedVehicles.length > 0 ? <FleetTrackerMap vehicles={trackedVehicles} drivers={drivers} loads={loads} /> : (
              <div className="flex h-[360px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                Run a Samsara sync to populate GPS tracker points on the dashboard.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Tracker Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {trackedVehicles.map((vehicle) => {
                const driver = drivers.find((item) => item.assignedVehicleId === vehicle.id || item.id === vehicle.assignedDriverId);
                const activeLoad = getActiveDriverLoad(loads, driver?.id);

                return (
                <div key={vehicle.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{driver?.name || "Unassigned Driver"}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {activeLoad ? `${activeLoad.pickupLocation} → ${activeLoad.deliveryLocation}` : "No active load assigned"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {(vehicle.lastKnownSpeedMilesPerHour || 0) > 0 ? "moving" : "idle"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" />
                      {(vehicle.lastKnownSpeedMilesPerHour || 0).toFixed(0)} mph
                    </span>
                    <span>{vehicle.lastKnownLocationAt ? new Date(vehicle.lastKnownLocationAt).toLocaleTimeString() : "No timestamp"}</span>
                  </div>
                </div>
              )})}
            </div>
          </CardContent>
        </Card>
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

function FleetTrackerMap({
  vehicles,
  drivers,
  loads,
}: {
  vehicles: ReturnType<typeof getVehicles>;
  drivers: ReturnType<typeof getDrivers>;
  loads: ReturnType<typeof getLoads>;
}) {
  const coordinates = vehicles.filter((vehicle) =>
    typeof vehicle.lastKnownLatitude === "number" && typeof vehicle.lastKnownLongitude === "number",
  );
  const center: [number, number] = coordinates.length > 0
    ? [
        coordinates.reduce((sum, vehicle) => sum + (vehicle.lastKnownLatitude as number), 0) / coordinates.length,
        coordinates.reduce((sum, vehicle) => sum + (vehicle.lastKnownLongitude as number), 0) / coordinates.length,
      ]
    : [39.8283, -98.5795];

  return (
    <div className="h-[360px] overflow-hidden rounded-2xl border">
      <MapContainer
        center={center}
        zoom={coordinates.length === 1 ? 9 : 5}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {coordinates.map((vehicle) => (
          (() => {
            const driver = drivers.find((item) => item.assignedVehicleId === vehicle.id || item.id === vehicle.assignedDriverId);
            const activeLoad = getActiveDriverLoad(loads, driver?.id);

            return (
              <CircleMarker
                key={vehicle.id}
                center={[vehicle.lastKnownLatitude as number, vehicle.lastKnownLongitude as number]}
                radius={9}
                pathOptions={{
                  color: "#123d32",
                  weight: 2,
                  fillColor: (vehicle.lastKnownSpeedMilesPerHour || 0) > 0 ? "#d97706" : "#123d32",
                  fillOpacity: 0.88,
                }}
              >
                <Popup>
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">{driver?.name || "Unassigned Driver"}</p>
                      <p className="text-sm text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">
                        {activeLoad ? `${activeLoad.pickupLocation} → ${activeLoad.deliveryLocation}` : "No active load assigned"}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>Speed: {(vehicle.lastKnownSpeedMilesPerHour || 0).toFixed(0)} mph</p>
                      <p>Updated: {vehicle.lastKnownLocationAt ? new Date(vehicle.lastKnownLocationAt).toLocaleString() : "No timestamp"}</p>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })()
        ))}
      </MapContainer>
    </div>
  );
}

function getActiveDriverLoad(loads: ReturnType<typeof getLoads>, driverId?: string) {
  if (!driverId) return undefined;
  return loads.find((load) => load.driverId === driverId && ["booked", "dispatched", "in_transit"].includes(load.status));
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
