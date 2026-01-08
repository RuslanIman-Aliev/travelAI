
import { inngest } from "@/lib/inggest/client";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { tripId } = await req.json();

  // Send the event to Inngest (Instant response)
  await inngest.send({
    name: "trip.generate",
    data: { tripId },
  });

  return NextResponse.json({ success: true, message: "Background job started" });
}