import { ApiProperty } from '@nestjs/swagger';

/**
 * The one shape every failure takes, whatever threw it.
 *
 * Mirrors what `AllExceptionsFilter` writes. One shape for every error is what
 * lets a client parse failures with a single piece of code instead of one per
 * endpoint.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description:
      'Repeats the HTTP status, so a logged body is self-describing.',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description:
      'What went wrong, safe to show a user. An array when several fields failed validation at once - one entry per field, each prefixed with its path.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'No trip found for this user',
  })
  message!: string | string[];

  @ApiProperty({
    description: 'When the failure was rendered.',
    example: '2026-09-12T11:42:07.331Z',
    format: 'date-time',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Path that failed, including the global prefix.',
    example: '/api/v1/trips/cmf3k9x2b0000v8mc4h7q1abc',
  })
  path!: string;
}
