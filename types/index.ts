import { insertTripSchema } from "@/lib/validators";
import z from "zod";

export type TripInput = z.infer<typeof insertTripSchema> & {
  daysCount: number;
  id: string;
  status: string;
  userId: string;
  country: string | null;
  aiGenerated: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};
