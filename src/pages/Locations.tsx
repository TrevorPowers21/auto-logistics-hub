import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStoreData } from "@/hooks/use-store";
import { generateId, getLocations, saveLocations } from "@/lib/store";
import { LocationProfile } from "@/lib/types";
import { Plus } from "lucide-react";

export default function CustomersPage() {
  const locations = useStoreData(getLocations).slice().sort((a, b) => a.code.localeCompare(b.code));
  const [open, setOpen] = useState(false);

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const id = (formData.get("id") as string) || generateId();
    const nextLocation: LocationProfile = {
      id,
      code: (formData.get("code") as string).toUpperCase(),
      name: formData.get("name") as string,
      contactName: formData.get("contactName") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      address: formData.get("address") as string,
      notes: formData.get("notes") as string,
    };

    const remaining = locations.filter((location) => location.id !== id);
    saveLocations([...remaining, nextLocation]);
    setOpen(false);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Customers</CardTitle>
            <CardDescription>
              Pickup and dropoff customer directory with code, contact, and address details.
            </CardDescription>
          </div>
          <Button onClick={() => setOpen((current) => !current)}>
            <Plus className="mr-2 h-4 w-4" />
            {open ? "Close Form" : "Add Customer"}
          </Button>
        </CardHeader>
        {open ? (
          <CardContent>
            <LocationForm onSubmit={handleSave} />
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {locations.map((location) => (
          <Card key={location.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">{location.code}</CardTitle>
                <span className="text-sm text-muted-foreground">{location.name}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-medium">Contact:</span> {location.contactName || "—"}</p>
              <p><span className="font-medium">Phone:</span> {location.phone || "—"}</p>
              <p><span className="font-medium">Email:</span> {location.email || "—"}</p>
              <p><span className="font-medium">Address:</span> {location.address || "—"}</p>
              <p><span className="font-medium">Notes:</span> {location.notes || "—"}</p>
              <div className="pt-2">
                <details>
                    <summary className="cursor-pointer text-sm font-medium">Edit</summary>
                  <div className="mt-3">
                    <LocationForm location={location} onSubmit={handleSave} />
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LocationForm({
  location,
  onSubmit,
}: {
  location?: LocationProfile;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="id" defaultValue={location?.id || ""} />
      <Field label="Code">
        <Input name="code" defaultValue={location?.code || ""} required />
      </Field>
      <Field label="Name">
        <Input name="name" defaultValue={location?.name || ""} required />
      </Field>
      <Field label="Contact">
        <Input name="contactName" defaultValue={location?.contactName || ""} />
      </Field>
      <Field label="Phone">
        <Input name="phone" defaultValue={location?.phone || ""} />
      </Field>
      <Field label="Email">
        <Input name="email" defaultValue={location?.email || ""} />
      </Field>
      <Field label="Address">
        <Input name="address" defaultValue={location?.address || ""} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Notes">
          <Textarea name="notes" defaultValue={location?.notes || ""} rows={3} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Button type="submit">Save Customer</Button>
      </div>
    </form>
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
