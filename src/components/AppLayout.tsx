import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { getAppSetting, refreshFromSupabase } from "@/lib/store";

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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pageTitle = routeLabels[location.pathname] ?? "Monroe Auto Transport";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b px-4 bg-card shrink-0 gap-3">
            <SidebarTrigger className="shrink-0" />
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-semibold truncate">{pageTitle}</span>
            <div className="ml-auto">
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
