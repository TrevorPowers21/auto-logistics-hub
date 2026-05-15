import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { fetchSamsaraSafetyEvents, SamsaraSafetyEvent } from "@/lib/samsara";
import { AlertTriangle, Gauge, RefreshCw, ShieldAlert, Video } from "lucide-react";

const LOOKBACK_OPTIONS = [
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
];

function eventTone(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("crash") || t.includes("rollover")) return "bg-red-100 text-red-700 border-red-200";
  if (t.includes("harsh") || t.includes("distract") || t.includes("seatbelt")) return "bg-amber-100 text-amber-800 border-amber-200";
  if (t.includes("speed")) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function SafetyPage() {
  const [events, setEvents] = useState<SamsaraSafetyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(24);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSamsaraSafetyEvents({ lookbackHours: hours });
      setEvents(data);
    } catch (err) {
      toast("Safety events failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [hours]);

  const counts = useMemo(() => {
    const harsh = events.filter((e) => /harsh|distract|seatbelt/i.test(e.eventType)).length;
    const speeding = events.filter((e) => /speed/i.test(e.eventType)).length;
    const severe = events.filter((e) => /crash|rollover/i.test(e.eventType)).length;
    const drivers = new Set(events.map((e) => e.driverId).filter(Boolean)).size;
    return { harsh, speeding, severe, drivers };
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Safety Events
          </h1>
          <p className="text-sm text-muted-foreground">
            Live harsh-event feed from Samsara · requires "Read Safety Events" scope on the API token
          </p>
        </div>
        <div className="flex items-center gap-2">
          {LOOKBACK_OPTIONS.map((opt) => (
            <Button
              key={opt.hours}
              size="sm"
              variant={hours === opt.hours ? "default" : "outline"}
              onClick={() => setHours(opt.hours)}
            >
              {opt.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile icon={<AlertTriangle className="h-4 w-4" />} label="Severe" value={String(counts.severe)} color="red" />
        <KpiTile icon={<AlertTriangle className="h-4 w-4" />} label="Harsh / Distract" value={String(counts.harsh)} color="amber" />
        <KpiTile icon={<Gauge className="h-4 w-4" />} label="Speeding" value={String(counts.speeding)} color="orange" />
        <KpiTile icon={<ShieldAlert className="h-4 w-4" />} label="Drivers Flagged" value={String(counts.drivers)} color="navy" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : events.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No safety events in this window. If you expected results, confirm the token has
              <span className="font-medium"> Read Safety Events</span> scope enabled.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Speed</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {e.time ? new Date(e.time).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${eventTone(e.eventType)} text-[10px]`}>
                        {e.eventType}
                      </Badge>
                      {e.severity ? <div className="mt-1 text-[10px] text-muted-foreground">{e.severity}</div> : null}
                    </TableCell>
                    <TableCell className="text-sm">{e.driverName || "—"}</TableCell>
                    <TableCell className="text-sm">{e.vehicleName || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={e.address}>
                      {e.address || (e.latitude != null && e.longitude != null ? `${e.latitude.toFixed(3)}, ${e.longitude.toFixed(3)}` : "—")}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {e.speedMph != null ? (
                        <span>
                          {Math.round(e.speedMph)} mph
                          {e.postedSpeedMph ? <span className="text-muted-foreground"> / {Math.round(e.postedSpeedMph)}</span> : null}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {e.videoUrl ? (
                        <a href={e.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Video className="h-3 w-3" /> Clip
                        </a>
                      ) : null}
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

function KpiTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: "red" | "amber" | "orange" | "navy" }) {
  const borderClass = {
    red: "border-l-red-500",
    amber: "border-l-amber-500",
    orange: "border-l-orange-500",
    navy: "border-l-primary",
  }[color];
  return (
    <Card className={`border-l-4 ${borderClass}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
