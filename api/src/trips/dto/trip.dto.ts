import { ApiProperty } from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';

/**
 * One row of `Trip`, as `findAll` returns it - that query has no `select`, so
 * every scalar column is on the wire.
 *
 * Dates cross as ISO strings. `startDate` and `endDate` are stored as calendar
 * days rather than instants, so only their date part carries meaning.
 */
export class TripDto {
  @ApiProperty({
    description: 'Trip id, a cuid.',
    example: 'cmf3k9x2b0000v8mc4h7q1abc',
  })
  id!: string;

  @ApiProperty({
    description:
      'Owner. Every query is scoped to the caller, so this is always theirs.',
    example: 'cmf3k9x2b0000v8mc4h7q1xyz',
  })
  userId!: string;

  @ApiProperty({
    description:
      'User-chosen name. Null until renamed; the UI falls back to `destination`.',
    example: 'Summer in Paris',
    nullable: true,
    type: String,
  })
  title!: string | null;

  @ApiProperty({
    description:
      'City the itinerary was generated for. Renaming a trip does not change it, so a rename can never invalidate the plan.',
    example: 'Paris',
  })
  destination!: string;

  @ApiProperty({
    description: 'Country the destination is in.',
    example: 'France',
    nullable: true,
    type: String,
  })
  country!: string | null;

  @ApiProperty({
    description: 'First calendar day. Only the date part is meaningful.',
    example: '2026-06-10T00:00:00.000Z',
    format: 'date-time',
  })
  startDate!: string;

  @ApiProperty({
    description: 'Last calendar day, inclusive.',
    example: '2026-06-14T00:00:00.000Z',
    format: 'date-time',
  })
  endDate!: string;

  @ApiProperty({
    description: 'Days covered, counting both endpoints.',
    example: 5,
    minimum: 1,
  })
  daysCount!: number;

  @ApiProperty({
    description:
      'Destination photo from Pexels. Null until generation finishes, or after a miss.',
    example: 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg',
    nullable: true,
    type: String,
  })
  imageUrl!: string | null;

  @ApiProperty({
    description:
      'Lower end of the budget range, in whole units of `budgetCurrency`.',
    example: 500,
    nullable: true,
    type: Number,
  })
  budgetMin!: number | null;

  @ApiProperty({
    description: 'Upper end of the budget range.',
    example: 1500,
    nullable: true,
    type: Number,
  })
  budgetMax!: number | null;

  @ApiProperty({
    description: 'Set only when a range was given.',
    example: 'USD',
    nullable: true,
    type: String,
  })
  budgetCurrency!: string | null;

  @ApiProperty({
    description:
      'Interests the itinerary was generated for. Empty when none were chosen.',
    example: ['Museums', 'Food'],
    type: [String],
  })
  interests!: string[];

  @ApiProperty({
    description:
      'Lifecycle of the itinerary. `generating` is claimed before the background job is enqueued, so a second request cannot start a duplicate run.',
    enum: TripStatus,
    example: TripStatus.generated,
  })
  status!: TripStatus;

  @ApiProperty({
    description: 'When the trip was created.',
    example: '2026-05-02T09:14:33.120Z',
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    description:
      'Last write to the row, which includes the status transitions a generation goes through.',
    example: '2026-05-02T09:16:01.884Z',
    format: 'date-time',
  })
  updatedAt!: string;
}
