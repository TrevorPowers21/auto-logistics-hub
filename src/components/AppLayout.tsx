import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { getAppSetting, getDrivers, getLoads, refreshFromSupabase } from "@/lib/store";
import { Truck, Users } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/driver-recap": "Driver Recap",
  "/cars": "Cars",
  "/drivers": "Drivers",
  "/loads": "Loads",
  "/expenses": "Expenses",
  "/invoices": "Invoices",
  "/locations": "Customers",
  "/addresses": "Addresses",
  "/vehicles": "Fleet",
  "/planning": "Planning Board",
  "/fuel": "Fuel Tracking",
  "/settings": "Settings",
};

function SyncIndicator() {
  const [ago, setAgo] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const update = () => {
      const ts = getAppSetting("last_auto_sync");
      if (!ts) { setAgo(""); return; }
      const diff = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
      if (diff < 5) setAgo("just now");
      else if (diff < 60) setAgo(`${diff}s ago`);
      else setAgo(`${Math.round(diff / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 5000);
    window.addEventListener("store-update", update);
    return () => { clearInterval(id); window.removeEventListener("store-update", update); };
  }, []);

  const handleClick = async () => {
    setSyncing(true);
    try { await refreshFromSupabase(); } finally { setSyncing(false); }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      title="Click to sync now"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${syncing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
      {syncing ? "Syncing..." : ago ? `Synced ${ago}` : "Syncing..."}
    </button>
  );
}

function QuickStats() {
  const [stats, setStats] = useState({ loads: 0, drivers: 0 });

  useEffect(() => {
    const update = () => {
      const loads = getLoads().filter((l) => ["booked", "dispatched", "in_transit"].includes(l.status)).length;
      const drivers = getDrivers().filter((d) => d.status === "active").length;
      setStats({ loads, drivers });
    };
    update();
    window.addEventListener("store-update", update);
    return () => window.removeEventListener("store-update", update);
  }, []);

  return (
    <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Truck className="h-3 w-3" />
        <span className="tabular-nums font-medium">{stats.loads}</span> active
      </span>
      <span className="h-3 w-px bg-border" />
      <span className="flex items-center gap-1">
        <Users className="h-3 w-3" />
        <span className="tabular-nums font-medium">{stats.drivers}</span> drivers
      </span>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pageTitle = routeLabels[location.pathname] ?? "Monroe Auto Transport";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b px-4 bg-card shrink-0 gap-3">
            <SidebarTrigger className="shrink-0" />
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-semibold truncate">{pageTitle}</span>
            <div className="ml-auto flex items-center gap-4">
              <QuickStats />
              <SyncIndicator />
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
