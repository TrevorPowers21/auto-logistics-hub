import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStoreData } from "@/hooks/use-store";
import { generateId, getLocations, saveLocations } from "@/lib/store";
import { LocationProfile } from "@/lib/types";
import { Pencil, Plus, Search } from "lucide-react";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

export default function CustomersPage() {
  const locations = useStoreData(getLocations).slice().sort((a, b) => a.name.localeCompare(b.name));
  const [addOpen, setAddOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationProfile | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Group by first letter of name
  const grouped = useMemo(() => {
    const filtered = search
      ? locations.filter((l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.code.toLowerCase().includes(search.toLowerCase()) ||
          l.contactName?.toLowerCase().includes(search.toLowerCase()) ||
          l.address?.toLowerCase().includes(search.toLowerCase()),
        )
      : locations;

    const groups = new Map<string, LocationProfile[]>();
    for (const loc of filtered) {
      const first = loc.name.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(loc);
    }
    return groups;
  }, [locations, search]);

  // Which letters have entries
  const activeLetters = useMemo(() => new Set(grouped.keys()), [grouped]);

  // Visible customers: either filtered by letter or show first page
  const visibleGroups = useMemo(() => {
    if (search) return Array.from(grouped.entries());
    if (activeLetter) {
      const group = grouped.get(activeLetter);
      return group ? [[activeLetter, group] as [string, LocationProfile[]]] : [];
    }
    // Default: show first letter that has entries
    const first = ALPHA.find((l) => grouped.has(l));
    if (!first) return [];
    return [[first, grouped.get(first)!] as [string, LocationProfile[]]];
  }, [grouped, activeLetter, search]);

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
          <p className="text-muted-foreground text-sm mt-1">{locations.length} total</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
            <LocationForm key="add" onSubmit={handleSave} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + alphabet nav */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value) setActiveLetter(null); }}
            className="pl-9"
          />
        </div>

        {!search && (
          <div className="flex flex-wrap gap-1">
            {ALPHA.map((letter) => {
              const hasEntries = activeLetters.has(letter);
              const isActive = activeLetter === letter || (!activeLetter && ALPHA.find((l) => activeLetters.has(l)) === letter);
              return (
                <button
                  key={letter}
                  onClick={() => hasEntries && setActiveLetter(letter)}
                  disabled={!hasEntries}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : hasEntries
                      ? "bg-muted hover:bg-muted/80 text-foreground"
                      : "text-muted-foreground/30 cursor-default"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer cards */}
      {visibleGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {search ? "No customers match your search" : "No customers yet"}
        </p>
      ) : (
        visibleGroups.map(([letter, group]) => (
          <div key={letter}>
            {(search || !activeLetter) ? null : (
              <h2 className="text-lg font-semibold mb-3">{letter}</h2>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {group.map((location) => (
                <Card key={location.id} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setEditingLocation(location)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{location.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{location.code}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0 ml-3 max-w-[200px] truncate">
                      {location.notes || location.address?.split(",").slice(-2).join(",").trim() || ""}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingLocation} onOpenChange={(o) => !o && setEditingLocation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLocation?.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground font-mono">{editingLocation?.code}</span>
            </DialogTitle>
          </DialogHeader>
          {editingLocation && (
            <LocationForm
              key={editingLocation.id}
              location={editingLocation}
              onSubmit={handleSave}
              onDelete={() => handleDelete(editingLocation.id)}
            />
          )}
        </DialogContent>
      </Dialog>
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
        <Field label="Name">
          <Input name="name" defaultValue={location?.name || ""} required placeholder="Full business name" />
        </Field>
        <Field label="Code">
          <Input name="code" defaultValue={location?.code || ""} required placeholder="e.g. NBG" />
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
          <Button type="button" variant="destructive" onClick={onDelete}>Delete</Button>
        ) : <div />}
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
