import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  controllers: [GenerationController, TripsController],
  providers: [GenerationService, TripsService],
})
export class TripsModule {}
