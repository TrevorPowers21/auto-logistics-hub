import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer } from "react-leaflet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { fetchSamsaraAddresses, SamsaraAddress } from "@/lib/samsara";
import { MapPin, RefreshCw, Search } from "lucide-react";

export default function GeofencesPage() {
  const [addresses, setAddresses] = useState<SamsaraAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSamsaraAddresses();
      setAddresses(data);
    } catch (err) {
      toast("Geofences failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return addresses;
    return addresses.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      (a.formattedAddress || "").toLowerCase().includes(q) ||
      (a.tags || []).some((t) => t.name.toLowerCase().includes(q))
    );
  }, [addresses, search]);

  const withCoords = useMemo(
    () => filtered.filter((a) => a.latitude != null && a.longitude != null),
    [filtered],
  );

  const mapCenter = useMemo<[number, number]>(() => {
    if (withCoords.length === 0) return [39.8283, -98.5795];
    const lats = withCoords.map((a) => a.latitude!);
    const lngs = withCoords.map((a) => a.longitude!);
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
  }, [withCoords]);

  const withGeofence = filtered.filter((a) => a.geofence?.circle || a.geofence?.polygon).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Geofences</h1>
          <p className="text-sm text-muted-foreground">
            {addresses.length} addresses · {withGeofence} with geofence boundaries · synced from Samsara
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="h-[420px] overflow-hidden rounded-lg">
            <MapContainer
              center={mapCenter}
              zoom={withCoords.length === 1 ? 12 : 5}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {withCoords.map((addr) => {
                const lat = addr.latitude!;
                const lng = addr.longitude!;
                const circle = addr.geofence?.circle;
                const polygon = addr.geofence?.polygon;
                return (
                  <span key={addr.id}>
                    {circle ? (
                      <Circle
                        center={[circle.latitude, circle.longitude]}
                        radius={circle.radiusMeters}
                        pathOptions={{ color: "hsl(351, 85%, 42%)", weight: 2, fillOpacity: 0.15 }}
                      />
                    ) : null}
                    {polygon && polygon.vertices.length > 0 ? (
                      <Polygon
                        positions={polygon.vertices.map((v) => [v.latitude, v.longitude]) as [number, number][]}
                        pathOptions={{ color: "hsl(351, 85%, 42%)", weight: 2, fillOpacity: 0.15 }}
                      />
                    ) : null}
                    <Marker position={[lat, lng]}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-medium">{addr.name}</p>
                          <p className="text-muted-foreground">{addr.formattedAddress || "—"}</p>
                          {addr.tags && addr.tags.length > 0 ? (
                            <p className="mt-1 text-xs">{addr.tags.map((t) => t.name).join(", ")}</p>
                          ) : null}
                        </div>
                      </Popup>
                    </Marker>
                  </span>
                );
              })}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              All Geofences
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, address, tag…"
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
              {addresses.length === 0 ? "No geofences set up in Samsara yet." : "No matches."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Geofence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((addr) => (
                  <TableRow key={addr.id}>
                    <TableCell className="font-medium">{addr.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{addr.formattedAddress || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(addr.tags || []).map((t) => (
                          <Badge key={t.id} variant="secondary" className="text-[10px]">{t.name}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {addr.geofence?.circle
                        ? `Circle · ${Math.round(addr.geofence.circle.radiusMeters)} m`
                        : addr.geofence?.polygon
                        ? `Polygon · ${addr.geofence.polygon.vertices.length} pts`
                        : "—"}
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
