import type { Request } from 'express';
import { ScanRequestContext } from '../domain/types/scan-event.types';

export function buildScanRequestContext(request: Request): ScanRequestContext {
  const forwardedFor = request.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim();

  return {
    ipAddress: forwardedIp ?? request.ip ?? null,
    userAgent:
      typeof request.headers['user-agent'] === 'string'
        ? request.headers['user-agent']
        : null,
    referer:
      typeof request.headers.referer === 'string'
        ? request.headers.referer
        : null,
  };
}
