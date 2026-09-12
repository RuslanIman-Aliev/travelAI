import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import type { SessionUser } from '../auth/session-user.type';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  MAX_PAGE_SIZE,
  listTripsQuerySchema,
  MAX_TRIP_TITLE_LENGTH,
  tripIdSchema,
  tripTitleSchema,
  type ListTripsQuery,
} from './trips.schema';
import { ApiPaginatedResponse } from '../common/dto/api-paginated-response.decorator';
import { TripDetailDto } from './dto/trip-detail.dto';
import { TripDto } from './dto/trip.dto';
import { TripsService } from './trips.service';

@ApiTags('trips')
@ApiCookieAuth('session')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @ApiOperation({
    summary: "List the caller's trips",
    description:
      'Newest first. Every query is scoped to the session, so trips belonging to other users are unreachable. An empty result is a 200 with an empty array, not a 404.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'integer',
    minimum: 1,
    default: 1,
    description:
      'Page to read. An unparseable value falls back to the default.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'integer',
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: 10,
    description: `Trips per page, at most ${MAX_PAGE_SIZE}. Anything larger falls back to the default rather than being clamped.`,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TripStatus,
    description:
      'Filter by lifecycle status. An empty value means no filter; an unknown one is rejected.',
  })
  @ApiPaginatedResponse(
    TripDto,
    'trips',
    "The caller's trips, newest first, with pagination metadata.",
  )
  @ApiBadRequestResponse({
    description: 'A path or query parameter failed its schema.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No valid session on the request.',
    type: ErrorResponseDto,
  })
  findAll(
    @Query(new ZodValidationPipe(listTripsQuerySchema)) query: ListTripsQuery,
    @CurrentUser() user: SessionUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('No user found in request');
    }

    return this.tripsService.findAll({
      userId: user.id,
      ...query,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Read one trip with its itinerary',
    description:
      'Includes days sorted by number and their activities sorted by order. Ownership is part of the lookup, so an id owned by another user is indistinguishable from one that does not exist.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip id, a cuid.',
    example: 'cmf3k9x2b0000v8mc4h7q1abc',
  })
  @ApiOkResponse({
    description: "The caller's trip, with its days and activities.",
    type: TripDetailDto,
  })
  @ApiBadRequestResponse({
    description: 'A path or query parameter failed its schema.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No such trip, or it belongs to somebody else.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No valid session on the request.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', new ZodValidationPipe(tripIdSchema)) id: string,
    @CurrentUser() user: SessionUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('No user found in request');
    }

    const trip = await this.tripsService.findOne({
      tripId: id,
      userId: user.id,
    });

    if (!trip) {
      throw new NotFoundException('No trip found for this user');
    }

    return trip;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Same ceiling the Next action already enforces, so the move does not quietly
  // remove a limit that used to be there.
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({
    summary: 'Delete a trip',
    description:
      'Days and activities go with it through the schema cascade. Deleting something that is not there answers 404 rather than pretending to succeed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip id, a cuid.',
    example: 'cmf3k9x2b0000v8mc4h7q1abc',
  })
  @ApiNoContentResponse({ description: 'The trip was removed.' })
  @ApiBadRequestResponse({
    description: 'A path or query parameter failed its schema.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No such trip, or it belongs to somebody else.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No valid session on the request.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded; `Retry-After` says for how long.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id', new ZodValidationPipe(tripIdSchema)) id: string,
    @CurrentUser() user: SessionUser | undefined,
  ): Promise<void> {
    if (!user) {
      throw new UnauthorizedException('No user found in request');
    }

    const removed = await this.tripsService.remove({
      tripId: id,
      userId: user.id,
    });

    if (!removed) {
      throw new NotFoundException('No trip found for this user');
    }
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({
    summary: 'Rename a trip',
    description:
      'Title only - the destination an itinerary was generated from cannot be changed, so renaming never invalidates the plan.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip id, a cuid.',
    example: 'cmf3k9x2b0000v8mc4h7q1abc',
  })
  @ApiBody({
    // Swagger cannot read the Zod schema, so the body is described here as well
    // as validated there. `tripTitleSchema` is the one that decides.
    schema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          maxLength: MAX_TRIP_TITLE_LENGTH,
          description:
            'The new display name. Surrounding whitespace is trimmed.',
        },
      },
    },
  })
  @ApiNoContentResponse({ description: 'The trip was renamed.' })
  @ApiBadRequestResponse({
    description: 'The id or the body failed its schema.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No such trip, or it belongs to somebody else.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No valid session on the request.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded; `Retry-After` says for how long.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', new ZodValidationPipe(tripIdSchema)) id: string,
    @CurrentUser() user: SessionUser | undefined,
    @Body('title', new ZodValidationPipe(tripTitleSchema))
    title: string,
  ): Promise<void> {
    if (!user) {
      throw new UnauthorizedException('No user found in request');
    }

    const updated = await this.tripsService.rename({
      tripId: id,
      userId: user.id,
      title,
    });

    if (!updated) {
      throw new NotFoundException('No trip found for this user');
    }
  }
}
