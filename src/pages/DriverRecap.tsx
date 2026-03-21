import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useStoreData } from "@/hooks/use-store";
import { createEmptyStop, getBoardTotals, getYesterdayDate, normalizeBoardStops, sanitizeBoardStops } from "@/lib/driver-recap";
import { generateId, getLocations, getDriverBoards, getDrivers, saveDriverBoards, saveLocations } from "@/lib/store";
import { Driver, DriverBoardEntry, DriverBoardStop, LocationProfile } from "@/lib/types";
import { Check, ChevronDown, ChevronsUpDown, Plus, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type DriverSheetRow = {
  id: string;
  driver: Driver;
  board?: DriverBoardEntry;
  stops: DriverBoardStop[];
  totalCars: number;
  completedCars: number;
  heldCars: number;
};

type LocationTotal = {
  location: string;
  cars: number;
};

export default function DriverRecapPage() {
  const drivers = useStoreData(getDrivers);
  const boards = useStoreData(getDriverBoards);
  const locations = useStoreData(getLocations);
  const [date, setDate] = useState(getYesterdayDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const locationOptions = useMemo(() => locations.slice().sort((a, b) => a.code.localeCompare(b.code)), [locations]);

  const driverRows = useMemo<DriverSheetRow[]>(() => {
    return drivers
      .filter((driver) => driver.status !== "inactive")
      .map((driver) => {
        const board = boards.find((entry) => entry.driverId === driver.id && entry.date === date);
        const stops = normalizeBoardStops(board);
        const totals = getBoardTotals(stops);

        return {
          id: driver.id,
          driver,
          board,
          stops,
          totalCars: totals.totalCars,
          completedCars: totals.completedCars,
          heldCars: totals.heldCars,
        };
      });
  }, [boards, date, drivers]);

  const pickupRecap = useMemo(() => buildLocationRecap(driverRows, "pickup"), [driverRows]);
  const dropoffRecap = useMemo(() => buildLocationRecap(driverRows, "dropoff"), [driverRows]);

  const totals = useMemo(() => ({
    totalCars: driverRows.reduce((sum, row) => sum + row.totalCars, 0),
    completedCars: driverRows.reduce((sum, row) => sum + row.completedCars, 0),
    heldCars: driverRows.reduce((sum, row) => sum + row.heldCars, 0),
  }), [driverRows]);

  const handleSaveStops = (driverId: string, stops: DriverBoardStop[]) => {
    const normalizedStops = sanitizeBoardStops(stops);
    const existing = boards.find((entry) => entry.driverId === driverId && entry.date === date);
    const nextEntry: DriverBoardEntry = {
      id: existing?.id || generateId(),
      driverId,
      date,
      items: normalizedStops.map((stop) => `${stop.carCount}-${stop.pickupLocation}`),
      stops: normalizedStops,
      updatedAt: new Date().toISOString(),
    };
    const remaining = boards.filter((entry) => !(entry.driverId === driverId && entry.date === date));
    saveDriverBoards([...remaining, nextEntry]);
    toast("Driver sheet saved", {
      description: "The driver's loads were updated.",
    });
  };

  const handleCreateLocation = (rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return "";

    const upperValue = value.toUpperCase();
    const existing = locations.find((location) => location.code === upperValue || location.name.toUpperCase() === upperValue);
    if (existing) {
      return existing.code;
    }

    const nextLocation: LocationProfile = {
      id: generateId(),
      code: upperValue,
      name: value,
      contactName: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    };
    saveLocations([...locations, nextLocation]);
    toast("Customer added", {
      description: `${nextLocation.code} was added to Customers.`,
    });
    return nextLocation.code;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Driver Daily Sheet</CardTitle>
            <CardDescription>
              Vertical driver tables with editable loads, notes, and a recap sheet for the end of the day.
            </CardDescription>
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="driver-sheet-date">Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="driver-sheet-date"
                  type="button"
                  variant="outline"
                  className="w-full justify-between rounded-xl border-slate-200 bg-white px-4 py-6 text-left font-medium shadow-sm"
                >
                  <span>{format(new Date(`${date}T12:00:00`), "EEEE, MMMM d, yyyy")}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto rounded-2xl border-slate-200 p-0 shadow-xl">
                <Calendar
                  mode="single"
                  selected={new Date(`${date}T12:00:00`)}
                  onSelect={(selectedDate) => {
                    if (!selectedDate) return;
                    setDate(format(selectedDate, "yyyy-MM-dd"));
                    setCalendarOpen(false);
                  }}
                  className="rounded-2xl"
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Total Cars" value={totals.totalCars} />
            <MetricCard label="Completed" value={totals.completedCars} />
            <MetricCard label="Split" value={totals.heldCars} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pickup Recap Sheet</CardTitle>
            <CardDescription>Cars grouped by pickup location.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pickupRecap.length > 0 ? pickupRecap.map((item) => (
              <LocationRow key={item.location} location={item.location} cars={item.cars} />
            )) : (
              <p className="text-sm text-muted-foreground">No pickup recap for this date.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drop-off Recap Sheet</CardTitle>
            <CardDescription>Cars grouped by delivered or split end location.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dropoffRecap.length > 0 ? dropoffRecap.map((item) => (
              <LocationRow key={item.location} location={item.location} cars={item.cars} />
            )) : (
              <p className="text-sm text-muted-foreground">No drop-off recap for this date.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {driverRows.map((row) => (
          <DriverLoadTable
            key={row.id}
            row={row}
            locationOptions={locationOptions}
            onCreateLocation={handleCreateLocation}
            onSave={handleSaveStops}
          />
        ))}
      </div>
    </div>
  );
}

function DriverLoadTable({
  row,
  locationOptions,
  onCreateLocation,
  onSave,
}: {
  row: DriverSheetRow;
  locationOptions: LocationProfile[];
  onCreateLocation: (value: string) => string;
  onSave: (driverId: string, stops: DriverBoardStop[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stops, setStops] = useState<DriverBoardStop[]>([]);

  useEffect(() => {
    setStops(row.stops.length > 0 ? row.stops : [createEmptyStop()]);
  }, [row.stops]);

  const updateStop = (index: number, patch: Partial<DriverBoardStop>) => {
    setStops((current) => current.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop));
  };

  const addStop = () => setStops((current) => [...current, createEmptyStop()]);
  const removeStop = (index: number) => setStops((current) => current.length === 1 ? current : current.filter((_, stopIndex) => stopIndex !== index));

  const handleSave = () => {
    onSave(row.id, stops);
    setOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle>{row.driver.name}</CardTitle>
          <CardDescription>
            {row.totalCars} cars, {row.completedCars} completed, {row.heldCars} split
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cars</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Dropoff</TableHead>
                  <TableHead>Completed / Split</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.stops.length > 0 ? row.stops.map((stop) => (
                  <TableRow key={stop.id}>
                    <TableCell>{stop.carCount}</TableCell>
                    <TableCell>{stop.pickupLocation || "—"}</TableCell>
                    <TableCell>{stop.dropoffLocation || "—"}</TableCell>
                    <TableCell>{stop.status === "held_overnight" ? "Split" : "Completed"}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No loads entered for this driver.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setOpen(true)}>Edit Loads</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{row.driver.name} Loads</DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
            {stops.map((stop, index) => (
              <div key={stop.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">Load {index + 1}</p>
                  <Button variant="ghost" size="sm" onClick={() => removeStop(index)}>
                    Remove
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Number of Cars">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={String(stop.carCount)}
                      onChange={(event) => updateStop(index, { carCount: Number(event.target.value.replace(/\D/g, "")) || 0 })}
                      placeholder="Enter cars"
                    />
                  </Field>

                  <Field label="Completed or Split">
                    <Select
                      value={stop.status}
                      onValueChange={(value) => updateStop(index, { status: value as DriverBoardStop["status"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="held_overnight">Split</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Pickup Location">
                    <SearchableLocationSelect
                      value={stop.pickupLocation}
                      options={locationOptions}
                      placeholder="Select pickup"
                      onCreateLocation={onCreateLocation}
                      onValueChange={(value) => updateStop(index, { pickupLocation: value })}
                    />
                  </Field>

                  <Field label="Dropoff Location">
                    <SearchableLocationSelect
                      value={stop.dropoffLocation}
                      options={locationOptions}
                      placeholder="Select dropoff"
                      onCreateLocation={onCreateLocation}
                      onValueChange={(value) => updateStop(index, { dropoffLocation: value })}
                    />
                  </Field>

                  {stop.status === "held_overnight" ? (
                    <Field label="Split Location">
                      <SearchableLocationSelect
                        value={stop.overnightLocation || ""}
                        options={locationOptions}
                        placeholder="Select split location"
                        onCreateLocation={onCreateLocation}
                        onValueChange={(value) => updateStop(index, { overnightLocation: value })}
                      />
                    </Field>
                  ) : null}

                  <Field label="Notes / Issues">
                    <Textarea
                      value={stop.notes || ""}
                      onChange={(event) => updateStop(index, { notes: event.target.value })}
                      rows={3}
                      placeholder="Any issues, hold reason, or notes"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={addStop}>
              <Plus className="mr-2 h-4 w-4" />
              Add Another Load
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function buildLocationRecap(rows: DriverSheetRow[], type: "pickup" | "dropoff"): LocationTotal[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    for (const stop of row.stops) {
      const location = type === "pickup"
        ? stop.pickupLocation
        : (stop.status === "held_overnight" ? (stop.overnightLocation || stop.dropoffLocation) : stop.dropoffLocation);

      if (!location) continue;
      totals.set(location, (totals.get(location) || 0) + stop.carCount);
    }
  }

  return Array.from(totals.entries())
    .map(([location, cars]) => ({ location, cars }))
    .sort((a, b) => a.location.localeCompare(b.location));
}

function SearchableLocationSelect({
  value,
  options,
  placeholder,
  onCreateLocation,
  onValueChange,
}: {
  value: string;
  options: LocationProfile[];
  placeholder: string;
  onCreateLocation: (value: string) => string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.code === value);
  const canCreate = query.trim().length > 0 && !options.some((option) => {
    const normalized = query.trim().toUpperCase();
    return option.code === normalized || option.name.toUpperCase() === normalized;
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? `${selected.code} - ${selected.name}` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Type to search customers..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.code} ${option.name} ${option.contactName} ${option.address}`}
                  onSelect={() => {
                    onValueChange(option.code);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.code ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{option.code} - {option.name}</span>
                    <span className="text-xs text-muted-foreground">{option.contactName || option.address}</span>
                  </div>
                </CommandItem>
              ))}
              {canCreate ? (
                <CommandItem
                  value={`create ${query}`}
                  onSelect={() => {
                    const code = onCreateLocation(query);
                    if (code) {
                      onValueChange(code);
                    }
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Create customer "{query.trim()}"</span>
                    <span className="text-xs text-muted-foreground">Adds a basic record you can fill in later.</span>
                  </div>
                </CommandItem>
              ) : null}
            </CommandGroup>
            <CommandEmpty>No customer found.</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
