import { insertTripSchema } from "@/lib/validators";
import z from "zod";

export type TripInput = z.infer<typeof insertTripSchema>;