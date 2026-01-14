"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import Image from "next/image";

export function SidebarLogo() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center gap-4 mb-10 px-2 mt-6">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 animate-pulse" />
        <div className="h-6 w-32 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  const logoSrc =
    resolvedTheme === "dark"
      ? "/logo-dark.png"
      : "/logo-light.jpg";

  return (
    <div className="flex flex-col items-center gap-4 mb-10 px-2 mt-8 transition-all duration-500 ease-in-out">
      
      <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.5)] border border-white/10 ring-1 ring-white/20">
        <Image
          src={logoSrc}
          alt="TravelGuide Logo"
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className="flex flex-col items-center text-center">
        <span className="font-bold text-2xl tracking-tight bg-clip-text text-transparent bg-linear-to-b from-white to-white/70">
          TravelGuide
        </span>
        <span className="text-[11px] font-semibold text-blue-400 tracking-widest uppercase">
          AI Planner
        </span>
      </div>
    </div>
  );
}