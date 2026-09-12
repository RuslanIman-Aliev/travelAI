import z from 'zod';
export const tripIdSchema = z.cuid('Trip ID is invalid');
/** Longest trip name a user may set. */
export const MAX_TRIP_TITLE_LENGTH = 120;

export const tripTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(
    MAX_TRIP_TITLE_LENGTH,
    `Title must be ${MAX_TRIP_TITLE_LENGTH} characters or fewer`,
  );
export const MAX_PAGE_SIZE = 50;
const tripStatusSchema = z.enum(['draft', 'generating', 'generated', 'failed']);
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(10),
});
export const userTripsFilterSchema = z.object({
  status: z
    .union([tripStatusSchema, z.literal('')])
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
});

export const listTripsQuerySchema = paginationSchema.extend(
  userTripsFilterSchema.shape,
);

export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;
