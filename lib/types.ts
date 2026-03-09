import { Prisma } from "@prisma/client";

export type DayWithActivities = Prisma.DayGetPayload<{
  include: { activities: true }
}>;