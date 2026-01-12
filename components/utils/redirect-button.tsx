"use client";

import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

const RedirectButton = () => {
  const router = useRouter();
  return (
    <div className="flex gap-4">
      <Button variant="destructive" className="cursor-pointer " onClick={() => router.push("/new-trip")}>
        Start Over
      </Button>

      {/* Option B: Delete this failed trip and go back (Cleanup)
            <Button 
              variant="destructive" 
              onClick={async () => {
                 await deleteTrip(trip.id); // You need to create this server action
                 router.push("/create-trip");
              }}
            >
              Delete & New Search
            </Button> */}
    </div>
  );
};

export default RedirectButton;
