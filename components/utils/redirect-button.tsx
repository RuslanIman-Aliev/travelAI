"use client";

import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

const RedirectButton = () => {
  const router = useRouter();
  return (
    <div className="flex gap-4">
      <Button
        variant="destructive"
        className="cursor-pointer "
        onClick={() => router.push("/new-trip")}
      >
        Start Over
      </Button>
    </div>
  );
};

export default RedirectButton;
