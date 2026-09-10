import { Injectable } from '@nestjs/common';
import { DeviceType as PrismaDeviceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScanEventRepository } from '../domain/contracts/scan-event.repository';
import {
  AnalyticsMetrics,
  AnalyticsSummary,
  DateRangeFilter,
  MetricsFilter,
  PaginatedScanEvents,
  PaginationOptions,
  QrCodeAnalyticsDetail,
} from '../domain/types/analytics-summary.types';
import { CreateScanEventInput } from '../domain/types/scan-event.types';
import { DeviceType } from '../domain/types/device-type.type';

@Injectable()
export class PrismaScanEventRepository extends ScanEventRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateScanEventInput): Promise<void> {
    await this.prisma.scanEvent.create({
      data: {
        qrCodeId: input.qrCodeId,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        deviceType: this.toPrismaDeviceType(input.deviceType),
        operatingSystem: input.operatingSystem ?? null,
        browser: input.browser ?? null,
        referer: input.referer ?? null,
        country: input.country ?? null,
        state: input.state ?? null,
        city: input.city ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  async findQrCodeIdBySlug(slug: string): Promise<string | null> {
    const qrCode = await this.prisma.qrCode.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!qrCode || !qrCode.isActive) {
      return null;
    }

    return qrCode.id;
  }

  async getSummaryByUser(
    userId: string,
    range: DateRangeFilter,
  ): Promise<AnalyticsSummary> {
    const qrCodes = await this.prisma.qrCode.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        scanEvents: {
          where: this.buildDateFilter(range),
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summaries = qrCodes.map((qrCode) => ({
      qrCodeId: qrCode.id,
      name: qrCode.name,
      totalScans: qrCode.scanEvents.length,
    }));

    return {
      totalScans: summaries.reduce((total, item) => total + item.totalScans, 0),
      qrCodes: summaries,
    };
  }

  async getMetricsByUser(
    userId: string,
    filter: MetricsFilter,
  ): Promise<AnalyticsMetrics> {
    const events = await this.prisma.scanEvent.findMany({
      where: {
        qrCode: {
          userId,
          ...(filter.qrCodeId ? { id: filter.qrCodeId } : {}),
        },
        ...this.buildDateFilter(filter),
      },
      select: {
        occurredAt: true,
        deviceType: true,
        browser: true,
        operatingSystem: true,
        country: true,
        state: true,
        city: true,
      },
      orderBy: { occurredAt: 'asc' },
    });

    const byDevice: AnalyticsMetrics['byDevice'] = {
      mobile: 0,
      desktop: 0,
      tablet: 0,
      unknown: 0,
    };
    const byBrowser: Record<string, number> = {};
    const byOperatingSystem: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byState: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    const timeline = new Map<string, number>();

    for (const event of events) {
      const deviceType = this.fromPrismaDeviceType(event.deviceType);
      byDevice[deviceType] += 1;

      if (event.browser) {
        byBrowser[event.browser] = (byBrowser[event.browser] ?? 0) + 1;
      }

      if (event.operatingSystem) {
        byOperatingSystem[event.operatingSystem] =
          (byOperatingSystem[event.operatingSystem] ?? 0) + 1;
      }

      if (event.country) {
        byCountry[event.country] = (byCountry[event.country] ?? 0) + 1;
      }

      if (event.state) {
        byState[event.state] = (byState[event.state] ?? 0) + 1;
      }

      if (event.city) {
        byCity[event.city] = (byCity[event.city] ?? 0) + 1;
      }

      const date = event.occurredAt.toISOString().slice(0, 10);
      timeline.set(date, (timeline.get(date) ?? 0) + 1);
    }

    return {
      totalScans: events.length,
      byDevice,
      byBrowser,
      byOperatingSystem,
      byCountry,
      byState,
      byCity,
      timeline: Array.from(timeline, ([date, totalScans]) => ({
        date,
        totalScans,
      })),
    };
  }

  async getQrCodeDetail(
    userId: string,
    qrCodeId: string,
    range: DateRangeFilter,
  ): Promise<QrCodeAnalyticsDetail | null> {
    const qrCode = await this.prisma.qrCode.findFirst({
      where: { id: qrCodeId, userId },
      select: {
        id: true,
        name: true,
        scanEvents: {
          where: this.buildDateFilter(range),
          select: { id: true },
        },
      },
    });

    if (!qrCode) {
      return null;
    }

    return {
      qrCodeId: qrCode.id,
      name: qrCode.name,
      totalScans: qrCode.scanEvents.length,
    };
  }

  async listQrCodeScans(
    userId: string,
    qrCodeId: string,
    range: DateRangeFilter,
    pagination: PaginationOptions,
  ): Promise<PaginatedScanEvents> {
    const qrCode = await this.prisma.qrCode.findFirst({
      where: { id: qrCodeId, userId },
      select: { id: true },
    });

    if (!qrCode) {
      return {
        items: [],
        page: pagination.page,
        limit: pagination.limit,
        total: 0,
        totalPages: 0,
      };
    }

    const where = {
      qrCodeId,
      ...this.buildDateFilter(range),
    };

    const [total, events] = await this.prisma.$transaction([
      this.prisma.scanEvent.count({ where }),
      this.prisma.scanEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);

    return {
      items: events.map((event) => ({
        id: event.id,
        qrCodeId: event.qrCodeId,
        occurredAt: event.occurredAt.toISOString(),
        deviceType: this.fromPrismaDeviceType(event.deviceType),
        operatingSystem: event.operatingSystem,
        browser: event.browser,
        userAgent: event.userAgent,
        referer: event.referer,
        country: event.country,
        state: event.state,
        city: event.city,
      })),
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
    };
  }

  private buildDateFilter(range: DateRangeFilter): Prisma.ScanEventWhereInput {
    if (!range.from && !range.to) {
      return {};
    }

    return {
      occurredAt: {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      },
    };
  }

  private toPrismaDeviceType(deviceType: DeviceType): PrismaDeviceType {
    return deviceType;
  }

  private fromPrismaDeviceType(deviceType: PrismaDeviceType): DeviceType {
    return deviceType;
  }
}
