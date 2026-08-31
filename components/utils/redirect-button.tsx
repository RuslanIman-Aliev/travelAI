"use client";

import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

const RedirectButton = () => {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      className="h-11 lg:h-9"
      onClick={() => router.push("/new-trip")}
    >
      Plan a new trip
    </Button>
  );
};

export default RedirectButton;
