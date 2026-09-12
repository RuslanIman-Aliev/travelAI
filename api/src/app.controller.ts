import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/public.decorator';
import { HealthDto } from './common/dto/health.dto';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  // Exempt from the global session guard: a health check that needs a session
  // cannot tell you the service is up.
  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Counts trips, so the check fails when the database is unreachable rather than only when the process is down. The only route that needs no session.',
  })
  @ApiOkResponse({
    description: 'The service and its database are reachable.',
    type: HealthDto,
  })
  async health() {
    return { trips: await this.prisma.trip.count() };
  }
}
