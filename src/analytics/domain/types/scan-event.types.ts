import { DeviceType } from './device-type.type';

export type ScanEventRecord = {
  id: string;
  qrCodeId: string;
  occurredAt: string;
  deviceType: DeviceType;
  operatingSystem: string | null;
  browser: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
};

export type CreateScanEventInput = {
  qrCodeId: string;
  ipHash?: string | null;
  userAgent?: string | null;
  deviceType: DeviceType;
  operatingSystem?: string | null;
  browser?: string | null;
  referer?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  occurredAt?: Date;
};

export type ScanRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  referer?: string | null;
};
