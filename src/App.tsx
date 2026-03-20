import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index.tsx";
import DriversPage from "./pages/Drivers.tsx";
import LoadsPage from "./pages/Loads.tsx";
import ExpensesPage from "./pages/Expenses.tsx";
import InvoicesPage from "./pages/Invoices.tsx";
import VehiclesPage from "./pages/Vehicles.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout><></></AppLayout>}>
            {/* Nested routes won't work this way, use layout wrapper */}
          </Route>
          <Route path="/" element={<AppLayout><Index /></AppLayout>} />
          <Route path="/drivers" element={<AppLayout><DriversPage /></AppLayout>} />
          <Route path="/loads" element={<AppLayout><LoadsPage /></AppLayout>} />
          <Route path="/expenses" element={<AppLayout><ExpensesPage /></AppLayout>} />
          <Route path="/invoices" element={<AppLayout><InvoicesPage /></AppLayout>} />
          <Route path="/vehicles" element={<AppLayout><VehiclesPage /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
