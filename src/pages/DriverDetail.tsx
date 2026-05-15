import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStoreData } from "@/hooks/use-store";
import { getDrivers, getVehicles } from "@/lib/store";
import {
  fetchSamsaraDriverSafetyScores,
  fetchSamsaraDvirs,
  fetchSamsaraHosClocks,
  fetchSamsaraSafetyEvents,
  fetchSamsaraTrips,
  fmtDuration,
  SamsaraDriverSafetyScore,
  SamsaraDvir,
  SamsaraHosClocks,
  SamsaraSafetyEvent,
  SamsaraTrip,
} from "@/lib/samsara";
import { Activity, AlertTriangle, ArrowLeft, ClipboardCheck, Phone, ShieldAlert, Timer, User } from "lucide-react";

const statusBadge: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-600",
  "on-leave": "bg-amber-100 text-amber-700",
};

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const drivers = useStoreData(getDrivers);
  const vehicles = useStoreData(getVehicles);
  const [hos, setHos] = useState<SamsaraHosClocks | null>(null);
  const [score, setScore] = useState<SamsaraDriverSafetyScore | null>(null);
  const [trips, setTrips] = useState<SamsaraTrip[]>([]);
  const [dvirs, setDvirs] = useState<SamsaraDvir[]>([]);
  const [events, setEvents] = useState<SamsaraSafetyEvent[]>([]);

  const driver = useMemo(() => drivers.find((d) => d.id === id), [drivers, id]);
  const vehicle = useMemo(
    () => vehicles.find((v) => v.id === driver?.assignedVehicleId || v.assignedDriverId === driver?.id),
    [vehicles, driver],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!driver?.externalId) return;
      const [hosAll, scores, dvirsAll, evtsAll] = await Promise.all([
        fetchSamsaraHosClocks(),
        fetchSamsaraDriverSafetyScores({ lookbackDays: 30 }),
        fetchSamsaraDvirs({ lookbackDays: 30 }),
        fetchSamsaraSafetyEvents({ lookbackHours: 168 }),
      ]);
      if (cancelled) return;
      setHos(hosAll.find((c) => c.driverId === driver.externalId) ?? null);
      setScore(scores.find((s) => s.driverId === driver.externalId) ?? null);
      setDvirs(dvirsAll.filter((d) => d.driverId === driver.externalId).slice(0, 20));
      setEvents(evtsAll.filter((e) => e.driverId === driver.externalId).slice(0, 20));

      if (vehicle?.externalId) {
        const recentTrips = await fetchSamsaraTrips({
          startMs: Date.now() - 7 * 86_400_000,
          endMs: Date.now(),
          vehicleIds: [vehicle.externalId],
        });
        if (!cancelled) setTrips(recentTrips.slice(0, 20));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [driver?.externalId, vehicle?.externalId]);

  if (!driver) {
    return (
      <div className="space-y-4">
        <Link to="/drivers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Drivers
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Driver not found.</CardContent>
        </Card>
      </div>
    );
  }

  const scoreTone =
    score?.safetyScore == null ? "border-l-gray-300"
    : score.safetyScore >= 90 ? "border-l-emerald-500"
    : score.safetyScore >= 75 ? "border-l-amber-500"
    : "border-l-red-500";

  return (
    <div className="space-y-6">
      <Link to="/drivers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Drivers
      </Link>

      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <User className="h-6 w-6 text-primary" />
                {driver.name}
                {driver.identifier ? <span className="text-base font-normal text-muted-foreground">#{driver.identifier}</span> : null}
              </CardTitle>
              <div className="mt-1 text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                {driver.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{driver.phone}</span> : null}
                {driver.licenseNumber ? <span>License {driver.licenseNumber}{driver.licenseState ? ` (${driver.licenseState})` : ""}</span> : null}
                {vehicle ? <span>Assigned: <Link to={`/vehicles/${vehicle.id}`} className="text-primary hover:underline">{vehicle.year} {vehicle.make} {vehicle.model}</Link></span> : null}
              </div>
            </div>
            <Badge variant="secondary" className={statusBadge[driver.status] || "bg-gray-100 text-gray-600"}>
              {driver.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className={`border-l-4 ${scoreTone}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <ShieldAlert className="h-4 w-4" /> Safety Score · 30d
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {score?.safetyScore != null ? score.safetyScore : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Timer className="h-4 w-4" /> Drive remaining
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {hos?.driveRemainingMs != null ? `${(hos.driveRemainingMs / 3_600_000).toFixed(1)}h` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Activity className="h-4 w-4" /> Shift remaining
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {hos?.shiftRemainingMs != null ? `${(hos.shiftRemainingMs / 3_600_000).toFixed(1)}h` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Activity className="h-4 w-4" /> Cycle remaining
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {hos?.cycleRemainingMs != null ? `${(hos.cycleRemainingMs / 3_600_000).toFixed(1)}h` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {score ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">30-day Driving Behavior</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
              <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Harsh Accel</div><div className="text-lg tabular-nums">{score.totalHarshAccelEvents ?? 0}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Harsh Brake</div><div className="text-lg tabular-nums">{score.totalHarshBrakingEvents ?? 0}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Harsh Turn</div><div className="text-lg tabular-nums">{score.totalHarshTurningEvents ?? 0}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Speeding</div><div className="text-lg tabular-nums">{score.totalSpeedingEvents ?? 0}</div></div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {events.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recent Safety Events (last 7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs tabular-nums">{e.time ? new Date(e.time).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell className="text-xs"><Badge variant="secondary" className="text-[10px]">{e.eventType}</Badge></TableCell>
                    <TableCell className="text-sm">{e.vehicleName || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{e.address || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Recent DVIRs (last 30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dvirs.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No inspections submitted.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Defects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dvirs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs tabular-nums">{d.time ? new Date(d.time).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell className="text-xs"><Badge variant="secondary" className="text-[10px]">{d.inspectionType || "—"}</Badge></TableCell>
                    <TableCell className="text-sm">{d.vehicleName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={d.safe ? "bg-emerald-100 text-emerald-700 text-[10px]" : "bg-red-100 text-red-700 text-[10px]"}>
                        {d.safe ? "Safe" : "Unsafe"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.defects.length === 0 ? <span className="text-muted-foreground">None</span> : `${d.defects.length} defect${d.defects.length === 1 ? "" : "s"}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {trips.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Trips (last 7 days — from assigned vehicle)</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <TableCell className="text-xs tabular-nums">{trip.startTime ? new Date(trip.startTime).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums">{trip.endTime ? new Date(trip.endTime).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell className="text-xs">{trip.startLocation || "—"}</TableCell>
                    <TableCell className="text-xs">{trip.endLocation || "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{trip.durationMs ? fmtDuration(trip.durationMs) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
