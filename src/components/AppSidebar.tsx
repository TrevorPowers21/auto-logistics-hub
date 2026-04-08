import {
  LayoutDashboard,
  Users,
  Truck,
  DollarSign,
  CarFront,
  ClipboardList,
  MapPinned,
  Car,
  Settings,
  CalendarDays,
  Fuel,
  Receipt,
  Building2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navGroups = [
  {
    label: "Dispatch",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Planning Board", url: "/planning", icon: CalendarDays },
      { title: "Driver Recap", url: "/driver-recap", icon: ClipboardList },
      { title: "Loads", url: "/loads", icon: Truck },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Cars", url: "/cars", icon: Car },
      { title: "Fleet", url: "/vehicles", icon: CarFront },
    ],
  },
  {
    label: "People & Places",
    items: [
      { title: "Drivers", url: "/drivers", icon: Users },
      { title: "Customers", url: "/locations", icon: Building2 },
      { title: "Addresses", url: "/addresses", icon: MapPinned },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Expenses", url: "/expenses", icon: DollarSign },
      { title: "Invoices", url: "/invoices", icon: Receipt },
      { title: "Fuel", url: "/fuel", icon: Fuel },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-slate-900 font-extrabold text-sm tracking-tight">
            M
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-accent-foreground tracking-tight leading-tight">
                Monroe Auto
              </span>
              <span className="text-[11px] text-sidebar-foreground/50 font-medium">
                Transport & Sales
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="text-sidebar-foreground/30 uppercase text-[10px] tracking-[0.12em] font-semibold mb-0.5">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent/60 transition-colors rounded-md"
                        activeClassName="bg-sidebar-accent text-amber-400 font-medium"
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
        ))}
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/settings"
                className="hover:bg-sidebar-accent/60 transition-colors rounded-md"
                activeClassName="bg-sidebar-accent text-amber-400 font-medium"
              >
                <Settings className="h-4 w-4" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
