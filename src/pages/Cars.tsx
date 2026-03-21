import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useStoreData } from "@/hooks/use-store";
import { decodeVin } from "@/lib/vin";
import { generateId, getCars, saveCars } from "@/lib/store";
import { Car } from "@/lib/types";
import { Plus, Search } from "lucide-react";

export default function CarsPage() {
  const cars = useStoreData(getCars);
  const [open, setOpen] = useState(false);
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDecodeVin = async () => {
    try {
      setLoading(true);
      const decoded = await decodeVin(vin);
      setYear(String(decoded.year));
      setMake(decoded.make);
      setModel(decoded.model);
      setVehicleName(decoded.vehicleName);
      toast("VIN decoded", {
        description: "Year, make, model, and vehicle name were filled in.",
      });
    } catch (error) {
      toast("VIN lookup failed", {
        description: error instanceof Error ? error.message : "Unable to decode VIN.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newCar: Car = {
      id: generateId(),
      vin: vin.trim().toUpperCase(),
      year: Number(year),
      make: make.trim(),
      model: model.trim(),
      vehicleName: vehicleName.trim() || `${make.trim()} ${model.trim()}`.trim(),
      color: color.trim(),
      notes: notes.trim(),
    };

    saveCars([...cars, newCar]);
    setOpen(false);
    setVin("");
    setYear("");
    setMake("");
    setModel("");
    setVehicleName("");
    setColor("");
    setNotes("");
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cars</h1>
          <p className="text-muted-foreground text-sm mt-1">{cars.length} cars tracked</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Car</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Car</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddCar} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <Label>VIN</Label>
                  <Input
                    value={vin}
                    onChange={(event) => setVin(event.target.value.toUpperCase())}
                    placeholder="Enter VIN"
                    required
                  />
                </div>
                <div className="self-end">
                  <Button type="button" variant="outline" onClick={handleDecodeVin} disabled={loading}>
                    <Search className="mr-2 h-4 w-4" />
                    {loading ? "Decoding..." : "Decode VIN"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Year</Label>
                  <Input value={year} onChange={(event) => setYear(event.target.value)} required />
                </div>
                <div>
                  <Label>Make</Label>
                  <Input value={make} onChange={(event) => setMake(event.target.value)} required />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input value={model} onChange={(event) => setModel(event.target.value)} required />
                </div>
                <div>
                  <Label>Vehicle Name</Label>
                  <Input value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} required />
                </div>
                <div className="sm:col-span-2">
                  <Label>Color</Label>
                  <Input value={color} onChange={(event) => setColor(event.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
                </div>
              </div>

              <Button type="submit" className="w-full">Save Car</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VIN</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Vehicle Name</TableHead>
                <TableHead>Color</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cars.map((car) => (
                <TableRow key={car.id}>
                  <TableCell className="font-mono text-sm">{car.vin}</TableCell>
                  <TableCell>{car.year}</TableCell>
                  <TableCell>{car.make}</TableCell>
                  <TableCell>{car.model}</TableCell>
                  <TableCell>{car.vehicleName}</TableCell>
                  <TableCell>{car.color || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
