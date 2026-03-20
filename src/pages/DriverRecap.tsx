import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStoreData } from "@/hooks/use-store";
import { getDriverBoards, getDrivers } from "@/lib/store";
import { getBoardTotals, getYesterdayDate, normalizeBoardStops } from "@/lib/driver-recap";

interface LocationTotal {
  location: string;
  cars: number;
}

export default function DriverRecapPage() {
  const drivers = useStoreData(getDrivers);
  const boards = useStoreData(getDriverBoards);
  const [date, setDate] = useState(getYesterdayDate);

  const driverRows = useMemo(() => {
    return drivers
      .filter((driver) => driver.status !== "inactive")
      .map((driver) => {
        const board = boards.find((entry) => entry.driverId === driver.id && entry.date === date);
        const stops = normalizeBoardStops(board);
        const totals = getBoardTotals(stops);

        const pickupTotals = new Map<string, number>();
        const dropoffTotals = new Map<string, number>();

        for (const stop of stops) {
          if (stop.pickupLocation) {
            pickupTotals.set(stop.pickupLocation, (pickupTotals.get(stop.pickupLocation) || 0) + stop.carCount);
          }

          const endLocation = stop.status === "held_overnight"
            ? (stop.overnightLocation || stop.dropoffLocation)
            : stop.dropoffLocation;

          if (endLocation) {
            dropoffTotals.set(endLocation, (dropoffTotals.get(endLocation) || 0) + stop.carCount);
          }
        }

        return {
          id: driver.id,
          driver: driver.name,
          totalPickupCars: totals.totalCars,
          completedCars: totals.completedCars,
          heldCars: totals.heldCars,
          pickupTotals: mapToList(pickupTotals),
          endLocationTotals: mapToList(dropoffTotals),
        };
      });
  }, [boards, date, drivers]);

  const recapTotals = useMemo(() => {
    const pickupTotals = new Map<string, number>();
    const endLocationTotals = new Map<string, number>();

    for (const row of driverRows) {
      for (const item of row.pickupTotals) {
        pickupTotals.set(item.location, (pickupTotals.get(item.location) || 0) + item.cars);
      }

      for (const item of row.endLocationTotals) {
        endLocationTotals.set(item.location, (endLocationTotals.get(item.location) || 0) + item.cars);
      }
    }

    return {
      totalCars: driverRows.reduce((sum, row) => sum + row.totalPickupCars, 0),
      completedCars: driverRows.reduce((sum, row) => sum + row.completedCars, 0),
      heldCars: driverRows.reduce((sum, row) => sum + row.heldCars, 0),
      pickupTotals: mapToList(pickupTotals),
      endLocationTotals: mapToList(endLocationTotals),
    };
  }, [driverRows]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>End of Day Recap</CardTitle>
            <CardDescription>
              Driver sheet with separate pickup totals, separate drop-off totals, and recap sheets for the end of the day.
            </CardDescription>
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="recap-date">Date</Label>
            <Input
              id="recap-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Total Pickup Cars" value={recapTotals.totalCars} />
            <MetricCard label="Completed Cars" value={recapTotals.completedCars} />
            <MetricCard label="Held Overnight" value={recapTotals.heldCars} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pickup Recap Sheet</CardTitle>
            <CardDescription>Total cars grouped by pickup location.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recapTotals.pickupTotals.length > 0 ? recapTotals.pickupTotals.map((item) => (
              <LocationRow key={item.location} location={item.location} cars={item.cars} />
            )) : (
              <p className="text-sm text-muted-foreground">No pickup totals for this date.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drop-off Recap Sheet</CardTitle>
            <CardDescription>Total cars grouped by delivered or held end location.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recapTotals.endLocationTotals.length > 0 ? recapTotals.endLocationTotals.map((item) => (
              <LocationRow key={item.location} location={item.location} cars={item.cars} />
            )) : (
              <p className="text-sm text-muted-foreground">No end location totals for this date.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Driver Sheet</CardTitle>
          <CardDescription>
            Each driver shows total cars, pickup totals, drop-off totals, and completed versus held overnight.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Total Pickup Cars</TableHead>
                <TableHead>Pickup Breakdown</TableHead>
                <TableHead>Drop-off Breakdown</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Held Overnight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {driverRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.driver}</TableCell>
                  <TableCell>{row.totalPickupCars}</TableCell>
                  <TableCell>{formatLocationTotals(row.pickupTotals)}</TableCell>
                  <TableCell>{formatLocationTotals(row.endLocationTotals)}</TableCell>
                  <TableCell>{row.completedCars}</TableCell>
                  <TableCell>{row.heldCars}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function LocationRow({ location, cars }: { location: string; cars: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <span className="font-medium">{location}</span>
      <span className="text-sm text-muted-foreground">{cars} cars</span>
    </div>
  );
}

function mapToList(map: Map<string, number>): LocationTotal[] {
  return Array.from(map.entries())
    .map(([location, cars]) => ({ location, cars }))
    .sort((a, b) => a.location.localeCompare(b.location));
}

function formatLocationTotals(items: LocationTotal[]): string {
  return items.length > 0
    ? items.map((item) => `${item.location} (${item.cars})`).join(", ")
    : "—";
}
