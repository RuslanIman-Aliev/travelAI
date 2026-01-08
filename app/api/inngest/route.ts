import { inngest } from "@/lib/inggest/client";
import { generateTripFunction } from "@/lib/inggest/functions";
import { serve } from "inngest/next";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
   generateTripFunction
  ],
});