import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { fetchSamsaraDvirs, SamsaraDvir } from "@/lib/samsara";
import { CheckCircle2, ClipboardCheck, RefreshCw, Search, XCircle } from "lucide-react";

const LOOKBACK_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

export default function InspectionsPage() {
  const [dvirs, setDvirs] = useState<SamsaraDvir[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(14);
  const [search, setSearch] = useState("");
  const [onlyDefects, setOnlyDefects] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSamsaraDvirs({ lookbackDays: days });
      setDvirs(data);
    } catch (err) {
      toast("DVIRs failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [days]);

  const filtered = useMemo(() => {
    let out = dvirs;
    if (onlyDefects) out = out.filter((d) => !d.safe || d.defects.length > 0);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((d) =>
        (d.driverName || "").toLowerCase().includes(q) ||
        (d.vehicleName || "").toLowerCase().includes(q) ||
        d.defects.some((def) => (def.description || "").toLowerCase().includes(q))
      );
    }
    return out;
  }, [dvirs, search, onlyDefects]);

  const counts = useMemo(() => {
    const total = dvirs.length;
    const withDefects = dvirs.filter((d) => d.defects.length > 0).length;
    const unsafe = dvirs.filter((d) => d.safe === false).length;
    const unresolved = dvirs.filter((d) => d.defects.some((def) => !def.resolved)).length;
    return { total, withDefects, unsafe, unresolved };
  }, [dvirs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            DVIR Inspections
          </h1>
          <p className="text-sm text-muted-foreground">Pre- and post-trip vehicle inspection reports from Samsara</p>
        </div>
        <div className="flex items-center gap-2">
          {LOOKBACK_OPTIONS.map((opt) => (
            <Button
              key={opt.days}
              size="sm"
              variant={days === opt.days ? "default" : "outline"}
              onClick={() => setDays(opt.days)}
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
        <KpiTile label="Total inspections" value={String(counts.total)} color="navy" />
        <KpiTile label="With defects" value={String(counts.withDefects)} color="amber" />
        <KpiTile label="Marked unsafe" value={String(counts.unsafe)} color="red" />
        <KpiTile label="Open defects" value={String(counts.unresolved)} color="red" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Recent Inspections</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={onlyDefects ? "default" : "outline"}
                onClick={() => setOnlyDefects((v) => !v)}
              >
                Defects only
              </Button>
              <div className="relative w-72">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Driver, vehicle, defect…"
                  className="h-8 pl-7 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {dvirs.length === 0
                ? "No DVIRs in this window. Confirm the token has the DVIR scope enabled."
                : "No matches."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Defects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {d.time ? new Date(d.time).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary" className="text-[10px]">{d.inspectionType || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.driverName || "—"}</TableCell>
                    <TableCell className="text-sm">{d.vehicleName || "—"}</TableCell>
                    <TableCell>
                      {d.safe ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px] flex items-center gap-0.5 w-fit">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Safe
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 text-[10px] flex items-center gap-0.5 w-fit">
                          <XCircle className="h-2.5 w-2.5" /> Unsafe
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.defects.length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <div className="flex flex-col gap-0.5 max-w-[320px]">
                          {d.defects.slice(0, 4).map((def) => (
                            <span key={def.id} className={def.resolved ? "text-muted-foreground line-through" : "text-foreground"}>
                              · {def.description || def.id}
                            </span>
                          ))}
                          {d.defects.length > 4 ? (
                            <span className="text-muted-foreground">+{d.defects.length - 4} more</span>
                          ) : null}
                        </div>
                      )}
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

function KpiTile({ label, value, color }: { label: string; value: string; color: "red" | "amber" | "navy" }) {
  const borderClass = {
    red: "border-l-red-500",
    amber: "border-l-amber-500",
    navy: "border-l-primary",
  }[color];
  return (
    <Card className={`border-l-4 ${borderClass}`}>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
