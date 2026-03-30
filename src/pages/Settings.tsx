import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, PlugZap, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { getSavedSamsaraToken, saveSamsaraToken } from "@/lib/samsara";

const integrations = [
  { name: "Samsara", status: "Active", description: "Fleet GPS tracking and driver sync. Configure the API token above." },
  { name: "NHTSA VIN Decoder", status: "Active", description: "Public API for decoding VINs. No token required — used automatically in Fleet and Cars." },
  { name: "VehicleHaul", status: "Pending", description: "Primary dispatch software. No public API found — contact VehicleHaul at (888) 456-4777 to request API/export access." },
  { name: "QuickBooks", status: "Not Needed", description: "Invoicing flows VehicleHaul to QuickBooks automatically. Managed by bookkeeper — no app integration needed." },
  { name: "Fleet One", status: "Future", description: "Fuel card data (driver, location, gallons, cost). Daily email parse integration planned." },
  { name: "Central Dispatch", status: "Research", description: "No integration planned — fraud/security concerns in the industry. Flagged for future research only." },
];

export default function SettingsPage() {
  const [samsaraToken, setSamsaraToken] = useState("");
  const [showSamsaraToken, setShowSamsaraToken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getSavedSamsaraToken()
      .then((token) => setSamsaraToken(token))
      .catch(() => setSamsaraToken(""));
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSamsaraToken(samsaraToken.trim());
      toast("Settings saved", {
        description: "Samsara token updated for local sync.",
      });
    } catch (error) {
      toast("Failed to save settings", {
        description: error instanceof Error ? error.message : "Unknown settings save error.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage API tokens and external connections in one place.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            API Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Samsara</p>
                <p className="mt-1 text-sm text-muted-foreground">Used for Fleet and Drivers sync.</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {samsaraToken ? "Saved" : "Missing"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="space-y-2">
                <Label htmlFor="settings-samsara-token">Samsara API Token</Label>
                <Input
                  id="settings-samsara-token"
                  type={showSamsaraToken ? "text" : "password"}
                  value={samsaraToken}
                  onChange={(event) => setSamsaraToken(event.target.value)}
                  placeholder="Paste Samsara token here"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="self-end"
                onClick={() => setShowSamsaraToken((current) => !current)}
                aria-label={showSamsaraToken ? "Hide Samsara token" : "Show Samsara token"}
              >
                {showSamsaraToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button className="self-end" onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Token"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            Integration List
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {integrations.map((integration) => (
            <div key={integration.name} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{integration.name}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  integration.status === "Active" ? "bg-emerald-100 text-emerald-700"
                  : integration.status === "Pending" ? "bg-amber-100 text-amber-700"
                  : integration.status === "Future" ? "bg-blue-100 text-blue-700"
                  : "bg-muted text-muted-foreground"
                }`}>
                  {integration.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{integration.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
