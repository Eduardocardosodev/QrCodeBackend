import {
  AnalyticsSummary,
  AnalyticsMetrics,
  DateRangeFilter,
  MetricsFilter,
  PaginatedScanEvents,
  PaginationOptions,
  QrCodeAnalyticsDetail,
} from '../types/analytics-summary.types';
import { CreateScanEventInput } from '../types/scan-event.types';

export abstract class ScanEventRepository {
  abstract create(input: CreateScanEventInput): Promise<void>;

  abstract findQrCodeIdBySlug(slug: string): Promise<string | null>;

  abstract getSummaryByUser(
    userId: string,
    range: DateRangeFilter,
  ): Promise<AnalyticsSummary>;

  abstract getMetricsByUser(
    userId: string,
    filter: MetricsFilter,
  ): Promise<AnalyticsMetrics>;

  abstract getQrCodeDetail(
    userId: string,
    qrCodeId: string,
    range: DateRangeFilter,
  ): Promise<QrCodeAnalyticsDetail | null>;

  abstract listQrCodeScans(
    userId: string,
    qrCodeId: string,
    range: DateRangeFilter,
    pagination: PaginationOptions,
  ): Promise<PaginatedScanEvents>;
}
