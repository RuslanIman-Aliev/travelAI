"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Spinner } from "../ui/spinner";

const DayChanger = ({ totalDays }: { totalDays: number }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentDay = Number(searchParams.get("day")) || 0;
  const [isPending, startTransition] = useTransition();
  const handleNavigation = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= totalDays) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("day", newIndex.toString());

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };
  return (
    <div className="w-full flex justify-between p-5 items-center">
      <Button
        variant="ghost"
        className="cursor-pointer"
        onClick={() => handleNavigation(currentDay - 1)}
        disabled={currentDay <= 0 || isPending}
      >
        {isPending ? <Spinner className="size-8" /> : <ChevronLeft className="w-10! h-10!" />}
      </Button>
      <div className="text-2xl">Day &mdash; {currentDay + 1}</div>
      <Button
        variant="ghost"
        className="cursor-pointer"
        onClick={() => handleNavigation(currentDay + 1)}
        disabled={currentDay >= totalDays - 1 || isPending}
      >
        {isPending ? <Spinner className="size-8"/> : <ChevronRight className="w-10! h-10!" />}
      </Button>
    </div>
  );
};

export default DayChanger;
