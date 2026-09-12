import { ApiProperty } from '@nestjs/swagger';
import { ActivityDto } from './activity.dto';

/** One row of `Day` with its activities, as `findOne` includes them. */
export class DayDto {
  @ApiProperty({
    description: 'Day id, a cuid.',
    example: 'cmf3k9x2b0000v8mc4h7q1day',
  })
  id!: string;

  @ApiProperty({
    description: 'Trip this day belongs to.',
    example: 'cmf3k9x2b0000v8mc4h7q1abc',
  })
  tripId!: string;

  @ApiProperty({
    description: 'One-based. Days come back sorted by this.',
    example: 1,
    minimum: 1,
  })
  dayNumber!: number;

  @ApiProperty({
    description: 'Calendar day this covers. Only the date part is meaningful.',
    example: '2026-06-10T00:00:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  date!: string | null;

  @ApiProperty({
    description: 'One-line summary of the day from the model.',
    example: 'Classic first day: the Louvre, then the Seine at dusk.',
    nullable: true,
    type: String,
  })
  summary!: string | null;

  @ApiProperty({ type: [ActivityDto], description: 'Sorted by `order`.' })
  activities!: ActivityDto[];
}
