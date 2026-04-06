import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDrivers, getLoads, getExpenses, getInvoices, getVehicles } from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { Truck, Users, DollarSign, FileText, Gauge, MapPinned, Package, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

const statusColor: Record<string, string> = {
  booked: "bg-blue-100 text-blue-800",
  dispatched: "bg-amber-100 text-amber-800",
  in_transit: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
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
  const totalCarsInTransit = loads.filter((l) => l.status === "in_transit").reduce((s, l) => s + (l.carIds?.length || 0), 0);

  const chartData = [
    { name: "Revenue", value: totalRevenue, fill: "hsl(222, 47%, 16%)" },
    { name: "Expenses", value: monthExpenses, fill: "hsl(0, 72%, 51%)" },
    { name: "Outstanding", value: outstandingInvoices, fill: "hsl(38, 92%, 50%)" },
  ];

  const recentLoads = [...loads].sort((a, b) => b.pickupDate.localeCompare(a.pickupDate)).slice(0, 6);
  const trackedVehicles = vehicles.filter((vehicle) =>
    typeof vehicle.lastKnownLatitude === "number" && typeof vehicle.lastKnownLongitude === "number",
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Fleet overview — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Truck} label="Active Loads" value={activeLoads} color="text-amber-600" bg="bg-amber-50" />
        <KpiCard icon={Users} label="Active Drivers" value={activeDrivers} color="text-blue-600" bg="bg-blue-50" />
        <KpiCard icon={Package} label="Cars In Transit" value={totalCarsInTransit} color="text-violet-600" bg="bg-violet-50" />
        <KpiCard icon={DollarSign} label="Outstanding" value={`$${outstandingInvoices.toLocaleString()}`} color="text-amber-600" bg="bg-amber-50" />
      </div>

      {/* Map + Tracker */}
      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)]">
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold">Fleet GPS Tracker</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Live Samsara coordinates from the most recent fleet sync</p>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">
                <MapPinned className="h-3 w-3 mr-1" />
                {trackedVehicles.length} tracked
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            {trackedVehicles.length > 0 ? <FleetTrackerMap vehicles={trackedVehicles} drivers={drivers} loads={loads} /> : (
              <div className="flex h-[340px] items-center justify-center rounded-xl border-2 border-dashed border-muted text-sm text-muted-foreground">
                <div className="text-center space-y-2">
                  <MapPinned className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <p>Run a Samsara sync to populate GPS tracker</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tracker Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pb-4">
            {trackedVehicles.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <div className="text-center space-y-2">
                  <Gauge className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <p>No vehicles tracked yet</p>
                </div>
              </div>
            ) : (
              <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                {trackedVehicles.map((vehicle) => {
                  const driver = drivers.find((item) => item.assignedVehicleId === vehicle.id || item.id === vehicle.assignedDriverId);
                  const activeLoad = getActiveDriverLoad(loads, driver?.id);
                  const isMoving = (vehicle.lastKnownSpeedMilesPerHour || 0) > 0;

                  return (
                    <div key={vehicle.id} className="rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{driver?.name || "Unassigned Driver"}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {activeLoad ? `${activeLoad.pickupLocation} → ${activeLoad.deliveryLocation}` : "No active load"}
                          </p>
                        </div>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${isMoving ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                          {isMoving ? "Moving" : "Idle"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Gauge className="h-3 w-3" />
                          {(vehicle.lastKnownSpeedMilesPerHour || 0).toFixed(0)} mph
                        </span>
                        <span>{vehicle.lastKnownLocationAt ? new Date(vehicle.lastKnownLocationAt).toLocaleTimeString() : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts + Recent Loads */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Revenue vs Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recent Loads</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLoads.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <div className="text-center space-y-2">
                  <Truck className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <p>No loads created yet</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {recentLoads.map((load) => (
                  <div key={load.id} className="flex items-center justify-between py-2.5 border-b last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{load.referenceNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {load.pickupLocation || "—"} → {load.deliveryLocation || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {load.price > 0 && <span className="text-sm font-medium tabular-nums">${load.price.toLocaleString()}</span>}
                      <Badge variant="secondary" className={`text-[10px] ${statusColor[load.status] || ""}`}>
                        {load.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
    <div className="h-[340px] overflow-hidden rounded-xl border">
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
        {coordinates.map((vehicle) => {
          const driver = drivers.find((item) => item.assignedVehicleId === vehicle.id || item.id === vehicle.assignedDriverId);
          const activeLoad = getActiveDriverLoad(loads, driver?.id);
          const isMoving = (vehicle.lastKnownSpeedMilesPerHour || 0) > 0;

          return (
            <CircleMarker
              key={vehicle.id}
              center={[vehicle.lastKnownLatitude as number, vehicle.lastKnownLongitude as number]}
              radius={8}
              pathOptions={{
                color: "hsl(222, 47%, 16%)",
                weight: 2,
                fillColor: isMoving ? "hsl(38, 92%, 50%)" : "hsl(222, 47%, 16%)",
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="space-y-2">
                  <div>
                    <p className="font-medium">{driver?.name || "Unassigned"}</p>
                    <p className="text-sm text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">
                      {activeLoad ? `${activeLoad.pickupLocation} → ${activeLoad.deliveryLocation}` : "No active load"}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>Speed: {(vehicle.lastKnownSpeedMilesPerHour || 0).toFixed(0)} mph</p>
                    <p>Updated: {vehicle.lastKnownLocationAt ? new Date(vehicle.lastKnownLocationAt).toLocaleString() : "—"}</p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function getActiveDriverLoad(loads: ReturnType<typeof getLoads>, driverId?: string) {
  if (!driverId) return undefined;
  return loads.find((load) => load.driverId === driverId && ["booked", "dispatched", "in_transit"].includes(load.status));
}

function KpiCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${bg} ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
