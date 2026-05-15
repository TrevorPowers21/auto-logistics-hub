import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { useStoreData } from "@/hooks/use-store";
import { getDrivers, getVehicles } from "@/lib/store";
import { fetchSamsaraTrips, fmtDuration, isSamsaraConfigured, getSavedSamsaraToken, SamsaraTrip } from "@/lib/samsara";
import { ArrowLeft, Gauge, MapPin, Truck, Wrench, Clock, Activity } from "lucide-react";

const statusBadge: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  maintenance: "bg-amber-100 text-amber-700",
  retired: "bg-gray-100 text-gray-600",
};

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const vehicles = useStoreData(getVehicles);
  const drivers = useStoreData(getDrivers);
  const [trips, setTrips] = useState<SamsaraTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(7);

  const vehicle = useMemo(() => vehicles.find((v) => v.id === id), [vehicles, id]);
  const driver = useMemo(
    () => drivers.find((d) => d.assignedVehicleId === vehicle?.id || d.id === vehicle?.assignedDriverId),
    [drivers, vehicle],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = await getSavedSamsaraToken();
      if (!isSamsaraConfigured(token) || !vehicle?.externalId) return;
      setTripsLoading(true);
      try {
        const endMs = Date.now();
        const startMs = endMs - lookbackDays * 24 * 60 * 60 * 1000;
        const result = await fetchSamsaraTrips({ startMs, endMs, vehicleIds: [vehicle.externalId] });
        if (cancelled) return;
        const sorted = [...result].sort((a, b) => {
          const aEnd = a.endMs ?? (a.endTime ? Date.parse(a.endTime) : 0);
          const bEnd = b.endMs ?? (b.endTime ? Date.parse(b.endTime) : 0);
          return bEnd - aEnd;
        });
        setTrips(sorted);
      } catch (err) {
        toast("Trip history failed", { description: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        if (!cancelled) setTripsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [vehicle?.externalId, lookbackDays]);

  if (!vehicle) {
    return (
      <div className="space-y-4">
        <Link to="/vehicles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Fleet
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Vehicle not found.</CardContent>
        </Card>
      </div>
    );
  }

  const totalMiles = trips.reduce((sum, t) => sum + (t.distanceMeters ?? 0), 0) / 1609.344;
  const totalDurationMs = trips.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
  const movingNow = (vehicle.lastKnownSpeedMilesPerHour || 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/vehicles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Fleet
        </Link>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((days) => (
            <Button
              key={days}
              size="sm"
              variant={lookbackDays === days ? "default" : "outline"}
              onClick={() => setLookbackDays(days)}
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Truck className="h-6 w-6 text-primary" />
                {vehicle.year} {vehicle.make} {vehicle.model}
              </CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                VIN {vehicle.vin || "—"} · Plate {vehicle.licensePlate || "—"}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="secondary" className={statusBadge[vehicle.status]}>
                {vehicle.status}
              </Badge>
              {driver ? (
                <span className="text-sm text-muted-foreground">Driver: {driver.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          icon={<Activity className="h-4 w-4" />}
          label="Engine"
          value={vehicle.engineState || "—"}
          color={movingNow ? "emerald" : "navy"}
        />
        <KpiTile
          icon={<Gauge className="h-4 w-4" />}
          label="Speed"
          value={`${Math.round(vehicle.lastKnownSpeedMilesPerHour || 0)} mph`}
          color="amber"
        />
        <KpiTile
          icon={<Clock className="h-4 w-4" />}
          label="Last Seen"
          value={vehicle.lastKnownLocationAt ? new Date(vehicle.lastKnownLocationAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
          color="navy"
        />
        <KpiTile
          icon={<Gauge className="h-4 w-4" />}
          label="Odometer"
          value={vehicle.mileage ? `${Math.round(vehicle.mileage).toLocaleString()} mi` : "—"}
          color="emerald"
        />
      </div>

      {vehicle.lastKnownLatitude != null && vehicle.lastKnownLongitude != null ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Current Location
            </CardTitle>
            <div className="text-sm text-muted-foreground">{vehicle.lastKnownLocation || "—"}</div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-hidden rounded-lg border">
              <MapContainer
                center={[vehicle.lastKnownLatitude, vehicle.lastKnownLongitude]}
                zoom={11}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <CircleMarker
                  center={[vehicle.lastKnownLatitude, vehicle.lastKnownLongitude]}
                  radius={10}
                  pathOptions={{
                    color: "hsl(221, 65%, 15%)",
                    weight: 2,
                    fillColor: movingNow ? "hsl(351, 85%, 42%)" : "hsl(221, 65%, 15%)",
                    fillOpacity: 0.9,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                      <p>{driver?.name || "Unassigned"}</p>
                      <p className="text-muted-foreground">{vehicle.lastKnownLocation}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Trip History · last {lookbackDays} days</CardTitle>
            <div className="text-sm text-muted-foreground tabular-nums">
              {trips.length} trips · {Math.round(totalMiles).toLocaleString()} mi · {fmtDuration(totalDurationMs)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tripsLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading trips…</div>
          ) : trips.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No completed trips in this window.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="text-xs tabular-nums">
                      {trip.startTime ? new Date(trip.startTime).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {trip.endTime ? new Date(trip.endTime).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{trip.startLocation || "—"}</TableCell>
                    <TableCell className="text-xs">{trip.endLocation || "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{trip.durationMs ? fmtDuration(trip.durationMs) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-primary" />
            Maintenance Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!vehicle.maintenanceLog || vehicle.maintenanceLog.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No maintenance entries yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Mileage</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...vehicle.maintenanceLog].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs tabular-nums">{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{entry.type}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{entry.mileage.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{entry.details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {vehicle.notes ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{vehicle.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function KpiTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: "navy" | "emerald" | "amber" }) {
  const borderClass = {
    navy: "border-l-primary",
    emerald: "border-l-emerald-500",
    amber: "border-l-amber-500",
  }[color];
  return (
    <Card className={`border-l-4 ${borderClass}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
