"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteLiveGuideRoute } from "@/lib/actions/live-guide.actions";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/** Delete for a saved Live Guide route. */
const RouteCardActions = ({ routeId }: { routeId: string }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteLiveGuideRoute(routeId);

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 lg:size-9"
        aria-label="Delete route"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Delete this route?</DialogTitle>
            <DialogDescription>
              The route and its saved places are removed permanently. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11 lg:h-9"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-11 lg:h-9"
              onClick={onDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RouteCardActions;
