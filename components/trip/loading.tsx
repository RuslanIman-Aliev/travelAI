"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";

const LoadingSpinner = ({ tripId }: { tripId: string }) => {
  const router = useRouter();
  const isFetched = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const [shouldPoll, setShouldPoll] = useState(false);
  
 useEffect(() => {
    if (isFetched.current) return;
    isFetched.current = true;

    const startTripGeneration = async () => {
      try {
        const res = await fetch("/api/start-trip", {
          method: "POST",
          body: JSON.stringify({ tripId: tripId }),
        });
        
        if (res.ok) {
          toast.success("Trip generation started!");
          setShouldPoll(true);
        } else {
          const data = await res.json();
          setError(data.message || "Failed to generate trip");
          toast.error("Failed to start trip generation.");
        }
      } catch (error) {
        setError("Network connection error. Please try again.");
      }
    };
    startTripGeneration();
  }, [tripId]);

  // 2. The Polling Logic
  useEffect(() => {
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      router.refresh(); 
    }, 3000); 

    return () => clearInterval(interval); 
  }, [shouldPoll, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <h3 className="text-lg font-semibold text-red-600">
          Oops! Something went wrong
        </h3>
        <p className="text-slate-500 max-w-xs">{error}</p>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => router.push("/create-trip")}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <Image
        src="/image-for-loading-page.png"
        fill
        alt="Loading page image"
        className=" object-cover"
        priority
        sizes="100vw"
      />
      <div className="absolute inset-0 flex flex-col justify-center items-center z-10 dark:bg-[linear-gradient(to_right,#09090bE6,#232328E6)] ">
        <Empty className="w-full ">
          <EmptyHeader>
            <EmptyMedia>
              <Spinner className="size-10" />
            </EmptyMedia>
            <EmptyTitle className="text-3xl ">
              Processing your request
            </EmptyTitle>
            <EmptyDescription className="text-md pt-3">
              Please wait while we process your request. Do not refresh the
              page. This may take from 45 seconds to 1.5 minute.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
};

export default LoadingSpinner;
