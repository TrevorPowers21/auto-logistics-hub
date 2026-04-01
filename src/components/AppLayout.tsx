import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

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
          </header>
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
