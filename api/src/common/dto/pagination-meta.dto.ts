import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shapes exist only to describe the API to Swagger - nothing validates
 * against them and nothing constructs them. They mirror what the services
 * actually return, so they can drift from it silently: when a query's `select`
 * or `include` changes, change the shape here too.
 */
export class PaginationMetaDto {
  @ApiProperty({
    description: 'Trips matching the filter, across every page.',
    example: 37,
    minimum: 0,
  })
  totalCount!: number;

  @ApiProperty({
    description:
      'Computed from `totalCount` and the limit the server actually applied, which is not always the one that was asked for.',
    example: 4,
    minimum: 0,
  })
  totalPages!: number;

  @ApiProperty({
    description: 'Echo of the page that was served.',
    example: 1,
    minimum: 1,
  })
  currentPage!: number;

  @ApiProperty({
    description:
      'Page size the server applied. Differs from the requested one when that was out of range.',
    example: 10,
    minimum: 1,
  })
  limit!: number;
}
