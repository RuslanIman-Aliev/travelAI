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
import { Button } from "./ui/button";
import { auth } from "@/auth";
import { loginWithGoogle, logout } from "@/lib/actions/auth.actions";
import Image from "next/image";

//Main navigation items
const mainItems = [
  {
    title: "Dashboard",
    url: "/",
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

const AppSidebar = async () => {
  let fragment;
  const session = await auth();
  if (!session?.user) {
    fragment = (
      <form action={loginWithGoogle}>
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white "
        >
          Sign in with Google
        </Button>
      </form>
    );
  } else {
    fragment = (
      <div className="">
        <div className="relative w-8 h-8"><Image src={session.user.image!} alt="User Image" fill className="rounded-2xl"/></div>
        <h2 className="text-lg font-medium">{session.user.name}!</h2>
        <br />
      </div>
    );
  }
  return (
    <Sidebar className="gap-5">
      <SidebarContent>
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
          <SidebarMenuItem className="mt-7">
            <SidebarMenuButton asChild>{fragment}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="mt-7">
            {session?.user && (
              <form action={logout} className="pl-2">
                <Button type="submit" variant="destructive">
                  Sign Out
                </Button>
              </form>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="mb-6">
          <SidebarSeparator />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
