import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { fetchSamsaraDashcamMedia, fmtDuration, SamsaraDashcamMedia } from "@/lib/samsara";
import { Camera, Download, ExternalLink, Play, RefreshCw, Search, Video } from "lucide-react";

const LOOKBACK_OPTIONS = [
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
];

export default function DashcamPage() {
  const [media, setMedia] = useState<SamsaraDashcamMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(72);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSamsaraDashcamMedia({ lookbackHours: hours });
      setMedia(data);
    } catch (err) {
      toast("Dashcam fetch failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [hours]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return media;
    return media.filter((m) =>
      (m.vehicleName || "").toLowerCase().includes(q) ||
      (m.driverName || "").toLowerCase().includes(q) ||
      (m.triggerReason || "").toLowerCase().includes(q) ||
      (m.address || "").toLowerCase().includes(q)
    );
  }, [media, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" />
            Dashcam
          </h1>
          <p className="text-sm text-muted-foreground">
            Recent video media from in-cab cameras · requires Camera scope on the API token
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

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Recent Media · {filtered.length} clip{filtered.length === 1 ? "" : "s"}</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Vehicle, driver, location…"
                className="h-8 pl-7 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {media.length === 0
                ? "No dashcam clips in this window. Confirm your Samsara plan includes cameras and the token has Camera Media scope."
                : "No matches."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((m) => (
                <Card key={m.id} className="overflow-hidden">
                  <div className="relative aspect-video bg-muted">
                    {m.thumbnailUrl ? (
                      <img
                        src={m.thumbnailUrl}
                        alt={m.triggerReason || "Dashcam clip"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Video className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    )}
                    {m.videoUrl ? (
                      <a
                        href={m.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors"
                      >
                        <span className="rounded-full bg-white/90 p-3 opacity-0 hover:opacity-100 transition-opacity">
                          <Play className="h-5 w-5 text-black" />
                        </span>
                      </a>
                    ) : null}
                  </div>
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{m.vehicleName || "—"}</span>
                      {m.durationMs ? <Badge variant="secondary" className="text-[10px]">{fmtDuration(m.durationMs)}</Badge> : null}
                    </div>
                    {m.triggerReason ? (
                      <Badge variant="outline" className="text-[10px]">{m.triggerReason}</Badge>
                    ) : null}
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {m.recordedTime ? new Date(m.recordedTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    </div>
                    {m.driverName ? <div className="text-xs text-muted-foreground truncate">{m.driverName}</div> : null}
                    {m.address ? <div className="text-[11px] text-muted-foreground truncate" title={m.address}>{m.address}</div> : null}
                    {m.videoUrl ? (
                      <div className="flex gap-2 pt-1">
                        <a
                          href={m.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </a>
                        <a
                          href={m.videoUrl}
                          download
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Download className="h-3 w-3" /> Download
                        </a>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
