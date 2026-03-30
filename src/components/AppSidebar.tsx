import {
  LayoutDashboard,
  Users,
  Truck,
  DollarSign,
  FileText,
  CarFront,
  ClipboardList,
  MapPinned,
  Car,
  Settings,
  CalendarDays,
  Fuel,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Planning Board", url: "/planning", icon: CalendarDays },
  { title: "Driver Recap", url: "/driver-recap", icon: ClipboardList },
  { title: "Cars", url: "/cars", icon: Car },
  { title: "Loads", url: "/loads", icon: Truck },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Expenses", url: "/expenses", icon: DollarSign },
  { title: "Fuel", url: "/fuel", icon: Fuel },
  { title: "Customers", url: "/locations", icon: MapPinned },
  { title: "Drivers", url: "/drivers", icon: Users },
  { title: "Fleet", url: "/vehicles", icon: CarFront },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            AT
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-accent-foreground tracking-tight">
                Monroe Auto Transport
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                Fleet Manager
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[11px] tracking-wider">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
