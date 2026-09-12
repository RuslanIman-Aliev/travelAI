import { ApiProperty } from '@nestjs/swagger';
import { DayDto } from './day.dto';
import { TripDto } from './trip.dto';

/**
 * A trip with its itinerary, as `findOne` returns it.
 *
 * The list endpoint returns `TripDto` without this field: only the single-trip
 * query includes days and activities.
 */
export class TripDetailDto extends TripDto {
  @ApiProperty({ type: [DayDto], description: 'Sorted by `dayNumber`.' })
  tripDays!: DayDto[];
}
