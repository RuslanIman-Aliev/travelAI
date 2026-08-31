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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { deleteTrip, renameTrip } from "@/lib/actions/trip.actions";
import { MAX_TRIP_TITLE_LENGTH } from "@/lib/validators";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Rename and delete for a trip card.
 *
 * `trip.actions.ts` was `insert`, `get`, `list` and `stats` - there was no way to
 * remove a trip you no longer wanted or give it a name of your own, so a bad
 * trip stayed in the list forever.
 */
const TripCardActions = ({
  tripId,
  currentTitle,
}: {
  tripId: string;
  currentTitle: string;
}) => {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [isPending, startTransition] = useTransition();

  const onRename = () => {
    startTransition(async () => {
      const res = await renameTrip(tripId, title);

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setRenameOpen(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteTrip(tripId);

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setDeleteOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 lg:size-9"
            aria-label="Trip options"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setTitle(currentTitle);
              setRenameOpen(true);
            }}
          >
            <Pencil className="mr-2 size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Rename trip</DialogTitle>
            <DialogDescription>
              This changes the name you see. The destination the itinerary was
              built from stays the same.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={title}
            maxLength={MAX_TRIP_TITLE_LENGTH}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Trip name"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11 lg:h-9"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-11 lg:h-9"
              onClick={onRename}
              disabled={isPending || title.trim().length === 0}
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Delete this trip?</DialogTitle>
            <DialogDescription>
              The itinerary and all of its activities are removed permanently.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11 lg:h-9"
              onClick={() => setDeleteOpen(false)}
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

export default TripCardActions;
