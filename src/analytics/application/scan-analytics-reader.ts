import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class ScanAnalyticsReader {
  constructor(
    private readonly scanEventRepository: ScanEventRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getSummary(
    userId: string,
    range: DateRangeFilter,
  ): Promise<AnalyticsSummary> {
    return this.scanEventRepository.getSummaryByUser(userId, range);
  }

  async getMetrics(
    userId: string,
    filter: MetricsFilter,
  ): Promise<AnalyticsMetrics> {
    if (filter.qrCodeId) {
      await this.ensureQrCodeOwnership(userId, filter.qrCodeId);
    }

    return this.scanEventRepository.getMetricsByUser(userId, filter);
  }

  async getQrCodeDetail(
    userId: string,
    qrCodeId: string,
    range: DateRangeFilter,
  ): Promise<QrCodeAnalyticsDetail> {
    await this.ensureQrCodeOwnership(userId, qrCodeId);

    const detail = await this.scanEventRepository.getQrCodeDetail(
      userId,
      qrCodeId,
      range,
    );

    if (!detail) {
      throw new NotFoundException('QR Code não encontrado');
    }

    return detail;
  }

  async listQrCodeScans(
    userId: string,
    qrCodeId: string,
    range: DateRangeFilter,
    pagination: PaginationOptions,
  ): Promise<PaginatedScanEvents> {
    await this.ensureQrCodeOwnership(userId, qrCodeId);

    const result = await this.scanEventRepository.listQrCodeScans(
      userId,
      qrCodeId,
      range,
      pagination,
    );

    if (result.total === 0) {
      const exists = await this.prisma.qrCode.findFirst({
        where: { id: qrCodeId, userId },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundException('QR Code não encontrado');
      }
    }

    return result;
  }

  private async ensureQrCodeOwnership(
    userId: string,
    qrCodeId: string,
  ): Promise<void> {
    const qrCode = await this.prisma.qrCode.findUnique({
      where: { id: qrCodeId },
      select: { userId: true },
    });

    if (!qrCode) {
      throw new NotFoundException('QR Code não encontrado');
    }

    if (qrCode.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão para este QR Code');
    }
  }
}
