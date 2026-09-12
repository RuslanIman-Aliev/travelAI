import { Injectable } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll({
    userId,
    status,
    page,
    limit,
  }: {
    userId: string;
    status?: TripStatus | undefined;
    page: number;
    limit: number;
  }) {
    const where = {
      userId,
      status,
    };
    const [trips, totalCount] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return {
      trips,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
    };
  }

  async findOne({ tripId, userId }: { tripId: string; userId: string }) {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id: tripId,
        userId,
      },
      include: {
        tripDays: {
          orderBy: { dayNumber: 'asc' },
          include: { activities: { orderBy: { order: 'asc' } } },
        },
      },
    });
    return trip;
  }

  async remove({
    tripId,
    userId,
  }: {
    tripId: string;
    userId: string;
  }): Promise<boolean> {
    const deleted = await this.prisma.trip.deleteMany({
      where: { id: tripId, userId },
    });

    return deleted.count > 0;
  }

  async rename({
    tripId,
    userId,
    title,
  }: {
    tripId: string;
    userId: string;
    title: string;
  }) {
    const updated = await this.prisma.trip.updateMany({
      where: { id: tripId, userId },
      data: { title },
    });

    return updated.count > 0;
  }
}
