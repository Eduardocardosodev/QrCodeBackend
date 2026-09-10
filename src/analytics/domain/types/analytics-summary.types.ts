import { ScanEventRecord } from './scan-event.types';

export type QrCodeScanSummary = {
  qrCodeId: string;
  name: string;
  totalScans: number;
};

export type AnalyticsSummary = {
  totalScans: number;
  qrCodes: QrCodeScanSummary[];
};

export type AnalyticsMetrics = {
  totalScans: number;
  byDevice: Record<import('./device-type.type').DeviceType, number>;
  byBrowser: Record<string, number>;
  byOperatingSystem: Record<string, number>;
  byCountry: Record<string, number>;
  byState: Record<string, number>;
  byCity: Record<string, number>;
  timeline: Array<{
    date: string;
    totalScans: number;
  }>;
};

export type MetricsFilter = DateRangeFilter & {
  qrCodeId?: string;
};

export type QrCodeAnalyticsDetail = {
  qrCodeId: string;
  name: string;
  totalScans: number;
};

export type PaginatedScanEvents = {
  items: ScanEventRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type DateRangeFilter = {
  from?: Date;
  to?: Date;
};

export type PaginationOptions = {
  page: number;
  limit: number;
};
