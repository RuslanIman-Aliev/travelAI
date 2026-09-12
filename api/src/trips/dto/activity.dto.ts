import { ApiProperty } from '@nestjs/swagger';

/** One row of `Activity`, as the nested `include` in `findOne` returns it. */
export class ActivityDto {
  @ApiProperty({
    description: 'Activity id, a cuid.',
    example: 'cmf3k9x2b0000v8mc4h7q1act',
  })
  id!: string;

  @ApiProperty({
    description: 'Day this activity belongs to.',
    example: 'cmf3k9x2b0000v8mc4h7q1day',
  })
  dayId!: string;

  @ApiProperty({
    description: 'What the activity is, as shown in the itinerary.',
    example: 'Louvre Museum',
  })
  title!: string;

  @ApiProperty({
    description: 'Short blurb from the model.',
    example: 'World-famous art museum in a former royal palace.',
    nullable: true,
    type: String,
  })
  description!: string | null;

  @ApiProperty({
    description: 'Free text as the model produced it, not a parsed time.',
    example: '09:00',
    nullable: true,
    type: String,
  })
  time!: string | null;

  @ApiProperty({
    description:
      'Place as the model named it. Falls back to the title when the model gave only one of the two.',
    example: 'Louvre Museum',
    nullable: true,
    type: String,
  })
  placeName!: string | null;

  @ApiProperty({
    description: 'Category the UI draws an icon for.',
    example: 'Museum',
    nullable: true,
    type: String,
  })
  placeType!: string | null;

  @ApiProperty({
    description:
      'Null when the model returned no usable pair; both coordinates are set or neither is.',
    example: 48.8606,
    nullable: true,
    type: Number,
  })
  latitude!: number | null;

  @ApiProperty({
    description:
      'Set only together with `latitude`; never one without the other.',
    example: 2.3376,
    nullable: true,
    type: Number,
  })
  longitude!: number | null;

  @ApiProperty({
    description:
      'Money in minor units, parsed once on ingestion rather than at render time.',
    example: 2200,
    nullable: true,
    type: Number,
  })
  estimatedCostCents!: number | null;

  @ApiProperty({
    description: 'Currency of `estimatedCostCents`, as the model reported it.',
    example: 'EUR',
    nullable: true,
    type: String,
  })
  estimatedCostCurrency!: string | null;

  @ApiProperty({
    description:
      'True when the model said the activity is free, which is not the same as a cost of zero being unknown.',
    example: false,
  })
  estimatedCostIsFree!: boolean;

  @ApiProperty({
    description: 'Position as generated. Activities come back sorted by this.',
    example: 1,
    minimum: 1,
  })
  order!: number;

  @ApiProperty({
    description:
      'Position the user dragged it to, when they have. Kept apart from `order` so a regenerated itinerary does not inherit an arrangement of activities that no longer exist.',
    example: 2,
    nullable: true,
    type: Number,
  })
  userOrder!: number | null;
}
