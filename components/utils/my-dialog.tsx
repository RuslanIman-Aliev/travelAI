"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function MyModal({
  open,
  setOpen,
  googleMapsUrl,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  googleMapsUrl: string;
}) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>You successfully created a route!</DialogTitle>
          <DialogDescription>
            Your route is saved. Open it in Google Maps now, or find it again
            under Saved routes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 md:flex-row md:gap-0 md:justify-between">
          <Button
            variant="outline"
            className="mt-4 cursor-pointer h-11 lg:h-9"
            onClick={() => {
              setOpen(false);
              router.push("/live-guide/history");
            }}
          >
            See saved routes
          </Button>
          <Button
            asChild
            variant="outline"
            className="mt-4 cursor-pointer h-11 lg:h-9"
          >
            <Link
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setOpen(false);
                router.push("/live-guide/history");
              }}
            >
              Open in Google Maps
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
