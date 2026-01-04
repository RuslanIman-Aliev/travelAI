import {
  AudioWaveform,
  CirclePlay,
  LayoutDashboard,
  LogOut,
  Map,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "./ui/sidebar";
import Link from "next/link";

//Main navigation items
const mainItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "New Trip",
    url: "/new-trip",
    icon: CirclePlay,
  },
  {
    title: "My Maps",
    url: "/maps",
    icon: Map,
  },
  {
    title: "Live Guide",
    url: "/guide",
    icon: AudioWaveform,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

//Footer items
const footerItems = [
  {
    title: "Log Out",
    url: "/logout",
    icon: LogOut,
  },
];

const AppSidebar = () => {
  return (
    <Sidebar className="gap-5">
      <SidebarContent >
        <SidebarMenu>
          {mainItems.map((item) => (
            <SidebarMenuItem key={item.title} className="mt-7">
              <SidebarMenuButton asChild>
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
        <SidebarFooter >
        <SidebarMenu className="mb-6">
          <SidebarSeparator />
            {footerItems.map((item) => (
            <SidebarMenuItem key={item.title} className="mt-7">
              <SidebarMenuButton asChild>
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
