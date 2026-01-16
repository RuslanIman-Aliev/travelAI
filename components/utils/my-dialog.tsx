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
            Your route has been created successfully. You can open it in Google
            Maps or move to your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col md:flex-row md:justify-between">
          <Button
            variant="outline"
            className="mt-4 cursor-pointer"
            onClick={() => {
              setOpen(false);
              router.push("/");
            }}
          >
            Go to Dashboard
          </Button>
          <Button asChild variant="outline" className="mt-4 cursor-pointer">
            <Link
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={()=>{
                setOpen(false)
                router.push("/");
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
