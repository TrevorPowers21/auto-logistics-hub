import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index.tsx";
import DriverRecapPage from "./pages/DriverRecap.tsx";
import CustomersPage from "./pages/Locations.tsx";
import CarsPage from "./pages/Cars.tsx";
import DriversPage from "./pages/Drivers.tsx";
import LoadsPage from "./pages/Loads.tsx";
import ExpensesPage from "./pages/Expenses.tsx";
import InvoicesPage from "./pages/Invoices.tsx";
import VehiclesPage from "./pages/Vehicles.tsx";
import PlanningBoardPage from "./pages/PlanningBoard.tsx";
import FuelTrackingPage from "./pages/FuelTracking.tsx";
import SettingsPage from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout><Index /></AppLayout>} />
          <Route path="/driver-recap" element={<AppLayout><DriverRecapPage /></AppLayout>} />
          <Route path="/locations" element={<AppLayout><CustomersPage /></AppLayout>} />
          <Route path="/cars" element={<AppLayout><CarsPage /></AppLayout>} />
          <Route path="/drivers" element={<AppLayout><DriversPage /></AppLayout>} />
          <Route path="/loads" element={<AppLayout><LoadsPage /></AppLayout>} />
          <Route path="/expenses" element={<AppLayout><ExpensesPage /></AppLayout>} />
          <Route path="/invoices" element={<AppLayout><InvoicesPage /></AppLayout>} />
          <Route path="/vehicles" element={<AppLayout><VehiclesPage /></AppLayout>} />
          <Route path="/planning" element={<AppLayout><PlanningBoardPage /></AppLayout>} />
          <Route path="/fuel" element={<AppLayout><FuelTrackingPage /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
