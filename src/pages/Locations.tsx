import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStoreData } from "@/hooks/use-store";
import { generateId, getLocations, saveLocations } from "@/lib/store";
import { LocationProfile } from "@/lib/types";
import { MapPin, Pencil, Plus } from "lucide-react";

export default function CustomersPage() {
  const locations = useStoreData(getLocations).slice().sort((a, b) => a.code.localeCompare(b.code));
  const [addOpen, setAddOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationProfile | null>(null);

  const handleSave = (data: Omit<LocationProfile, "id"> & { id?: string }) => {
    const id = data.id || generateId();
    const next: LocationProfile = {
      id,
      code: data.code.toUpperCase(),
      name: data.name,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      notes: data.notes,
    };
    const remaining = locations.filter((l) => l.id !== id);
    saveLocations([...remaining, next]);
    setAddOpen(false);
    setEditingLocation(null);
  };

  const handleDelete = (id: string) => {
    saveLocations(locations.filter((l) => l.id !== id));
    setEditingLocation(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {locations.length} pickup and dropoff locations
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Customer Location</DialogTitle>
            </DialogHeader>
            <LocationForm key="add" onSubmit={handleSave} />
          </DialogContent>
        </Dialog>
      </div>

      {locations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No customer locations yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add pickup and dropoff locations to reference them in loads and driver recaps.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {locations.map((location) => (
            <Card key={location.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{location.name}</CardTitle>
                    <CardDescription className="mt-0.5 font-mono">{location.code}</CardDescription>
                  </div>
                  <Dialog
                    open={editingLocation?.id === location.id}
                    onOpenChange={(open) => setEditingLocation(open ? location : null)}
                  >
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Edit {location.name}</DialogTitle>
                      </DialogHeader>
                      <LocationForm
                        key={location.id}
                        location={location}
                        onSubmit={handleSave}
                        onDelete={() => handleDelete(location.id)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm pt-0">
                {location.contactName && (
                  <p>
                    <span className="font-medium text-muted-foreground">Contact:</span>{" "}
                    {location.contactName}
                  </p>
                )}
                {location.phone && (
                  <p>
                    <span className="font-medium text-muted-foreground">Phone:</span> {location.phone}
                  </p>
                )}
                {location.email && (
                  <p>
                    <span className="font-medium text-muted-foreground">Email:</span> {location.email}
                  </p>
                )}
                {location.address && (
                  <p>
                    <span className="font-medium text-muted-foreground">Address:</span> {location.address}
                  </p>
                )}
                {location.notes && (
                  <p className="text-muted-foreground italic">{location.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LocationForm({
  location,
  onSubmit,
  onDelete,
}: {
  location?: LocationProfile;
  onSubmit: (data: Omit<LocationProfile, "id"> & { id?: string }) => void;
  onDelete?: () => void;
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      id: location?.id,
      code: fd.get("code") as string,
      name: fd.get("name") as string,
      contactName: fd.get("contactName") as string,
      phone: fd.get("phone") as string,
      email: fd.get("email") as string,
      address: fd.get("address") as string,
      notes: fd.get("notes") as string,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Code">
          <Input name="code" defaultValue={location?.code || ""} required placeholder="e.g. SBT" />
        </Field>
        <Field label="Name">
          <Input name="name" defaultValue={location?.name || ""} required placeholder="Full location name" />
        </Field>
        <Field label="Contact">
          <Input name="contactName" defaultValue={location?.contactName || ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={location?.phone || ""} />
        </Field>
        <Field label="Email">
          <Input name="email" defaultValue={location?.email || ""} type="email" />
        </Field>
        <Field label="Address">
          <Input name="address" defaultValue={location?.address || ""} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Notes">
            <Textarea name="notes" defaultValue={location?.notes || ""} rows={2} />
          </Field>
        </div>
      </div>
      <div className="flex justify-between gap-3">
        {onDelete ? (
          <Button type="button" variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        ) : (
          <div />
        )}
        <Button type="submit">{location ? "Save Changes" : "Add Customer"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
