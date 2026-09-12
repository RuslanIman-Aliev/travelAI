import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';
import { MeController } from './me.controller';

@Module({
  providers: [
    SessionService,
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
  ],
  controllers: [MeController],
})
export class AuthModule {}
