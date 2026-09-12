import { ApiProperty } from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';

/** What the trip page polls while an itinerary is being generated. */
export class GenerationStatusDto {
  @ApiProperty({
    description:
      'Where the itinerary is. The page stops polling once this reaches `generated` or `failed`.',
    enum: TripStatus,
    example: TripStatus.generating,
  })
  status!: TripStatus;
}
