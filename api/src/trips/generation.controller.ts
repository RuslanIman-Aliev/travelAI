import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionUser } from '../auth/session-user.type';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GenerationStatusDto } from './dto/generation-status.dto';
import { GenerationService } from './generation.service';
import { tripIdSchema } from './trips.schema';

@ApiTags('generation')
@ApiCookieAuth('session')
@ApiParam({
  name: 'id',
  description: 'Trip id, a cuid.',
  example: 'cmf3k9x2b0000v8mc4h7q1abc',
})
@Controller('trips/:id/generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Get()
  @ApiOperation({
    summary: 'Itinerary generation status',
    description:
      'Polled by the trip page while a trip is being generated. Reads one column, so it is cheap enough to call on a schedule.',
  })
  @ApiOkResponse({
    description: 'Where the itinerary is.',
    type: GenerationStatusDto,
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
  async getGenerationStatus(
    @Param('id', new ZodValidationPipe(tripIdSchema)) tripId: string,
    @CurrentUser() user: SessionUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('No user found in request');
    }

    const status = await this.generationService.findStatus({
      tripId,
      userId: user.id,
    });

    if (!status) {
      throw new NotFoundException('No trip found for this user');
    }

    return { status };
  }
}
