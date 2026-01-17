"use client";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  AudioWaveform,
  CirclePlay,
  LayoutDashboard,
  Moon,
  Sun
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
    title: "Live Guide",
    url: "/live-guide",
    icon: AudioWaveform,
  },
];

export function SidebarMenuMain() {
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <SidebarMenu className="mt-5 gap-4">
      {mainItems.map((item) => {
        const isActive = pathname === item.url;
        
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton 
              asChild 
              isActive={isActive}
              tooltip={item.title}
              className="text-base py-3 h-auto data-[active=true]:bg-blue-50 data-[active=true]:text-blue-600 data-[active=true]:font-medium transition-all duration-200"
            >
              <Link href={item.url} className="flex items-center gap-4">
                <item.icon className="w-5 h-5" /> 
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}

      <SidebarMenuItem>
        <SidebarMenuButton 
          onClick={toggleTheme}
          tooltip="Toggle Theme"
          className="cursor-pointer text-base py-3 h-auto transition-all duration-200"
        >
          {mounted && theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="ml-4">{mounted && theme === 'dark' ? "Light Mode" : "Dark Mode"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}