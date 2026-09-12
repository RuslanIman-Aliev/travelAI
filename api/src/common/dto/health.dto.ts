import { ApiProperty } from '@nestjs/swagger';

/**
 * The liveness probe answers with a real query rather than a constant, so a
 * database that cannot be reached fails the check instead of passing it.
 */
export class HealthDto {
  @ApiProperty({
    description:
      'Trips in the database. The number is incidental; that it could be counted at all is the point.',
    example: 35,
    minimum: 0,
  })
  trips!: number;
}
