import { Injectable } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GenerationService {
  constructor(private readonly prisma: PrismaService) {}

  async findStatus({
    tripId,
    userId,
  }: {
    tripId: string;
    userId: string;
  }): Promise<TripStatus | null> {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id: tripId,
        userId,
      },
      select: {
        status: true,
      },
    });
    return trip?.status ?? null;
  }
}
