import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStoreData } from "@/hooks/use-store";
import { generateId, getAddresses, saveAddresses } from "@/lib/store";
import { Address } from "@/lib/types";
import { Pencil, Plus, Search } from "lucide-react";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

export default function AddressesPage() {
  const addresses = useStoreData(getAddresses).slice().sort((a, b) => a.name.localeCompare(b.name));
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const filtered = search
      ? addresses.filter((a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.city.toLowerCase().includes(search.toLowerCase()) ||
          a.state.toLowerCase().includes(search.toLowerCase()) ||
          a.line1.toLowerCase().includes(search.toLowerCase()),
        )
      : addresses;

    const groups = new Map<string, Address[]>();
    for (const addr of filtered) {
      const first = addr.name.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(addr);
    }
    return groups;
  }, [addresses, search]);

  const activeLetters = useMemo(() => new Set(grouped.keys()), [grouped]);

  const visibleGroups = useMemo(() => {
    if (search) return Array.from(grouped.entries());
    if (activeLetter) {
      const group = grouped.get(activeLetter);
      return group ? [[activeLetter, group] as [string, Address[]]] : [];
    }
    const first = ALPHA.find((l) => grouped.has(l));
    if (!first) return [];
    return [[first, grouped.get(first)!] as [string, Address[]]];
  }, [grouped, activeLetter, search]);

  const handleSave = (data: Omit<Address, "id"> & { id?: string }) => {
    const id = data.id || generateId();
    const next: Address = { id, ...data };
    const remaining = addresses.filter((a) => a.id !== id);
    saveAddresses([...remaining, next]);
    setAddOpen(false);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    saveAddresses(addresses.filter((a) => a.id !== id));
    setEditing(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Addresses</h1>
          <p className="text-muted-foreground text-sm mt-1">{addresses.length} total</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Address</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Address</DialogTitle></DialogHeader>
            <AddressForm key="add" onSubmit={handleSave} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + alphabet nav */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search addresses..."
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

      {/* Address cards */}
      {visibleGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {search ? "No addresses match your search" : "No addresses yet"}
        </p>
      ) : (
        visibleGroups.map(([letter, group]) => (
          <div key={letter}>
            {!search && activeLetter && (
              <h2 className="text-lg font-semibold mb-3">{letter}</h2>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {group.map((addr) => (
                <Card key={addr.id} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setEditing(addr)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{addr.name}</p>
                      {addr.line1 && <p className="text-xs text-muted-foreground truncate">{addr.line1}</p>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0 ml-3">
                      {[addr.city, addr.state].filter(Boolean).join(", ")}
                      {addr.zip && ` ${addr.zip}`}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <AddressForm
              key={editing.id}
              address={editing}
              onSubmit={handleSave}
              onDelete={() => handleDelete(editing.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddressForm({
  address,
  onSubmit,
  onDelete,
}: {
  address?: Address;
  onSubmit: (data: Omit<Address, "id"> & { id?: string }) => void;
  onDelete?: () => void;
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      id: address?.id,
      name: fd.get("name") as string,
      line1: fd.get("line1") as string,
      line2: (fd.get("line2") as string) || undefined,
      city: fd.get("city") as string,
      state: fd.get("state") as string,
      zip: fd.get("zip") as string,
      notes: (fd.get("notes") as string) || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="Name">
            <Input name="name" defaultValue={address?.name || ""} required placeholder="e.g. Healey Brothers, Main Shop" />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Street Address">
            <Input name="line1" defaultValue={address?.line1 || ""} placeholder="Street address" />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Address Line 2">
            <Input name="line2" defaultValue={address?.line2 || ""} placeholder="Suite, unit, etc." />
          </Field>
        </div>
        <Field label="City">
          <Input name="city" defaultValue={address?.city || ""} placeholder="City" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <Input name="state" defaultValue={address?.state || ""} placeholder="ST" />
          </Field>
          <Field label="Zip">
            <Input name="zip" defaultValue={address?.zip || ""} placeholder="Zip" />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Notes">
            <Textarea name="notes" defaultValue={address?.notes || ""} rows={2} />
          </Field>
        </div>
      </div>
      <div className="flex justify-between gap-3">
        {onDelete ? (
          <Button type="button" variant="destructive" onClick={onDelete}>Delete</Button>
        ) : <div />}
        <Button type="submit">{address ? "Save Changes" : "Add Address"}</Button>
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
