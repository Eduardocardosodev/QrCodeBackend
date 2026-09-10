import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScanEventRepository } from '../domain/contracts/scan-event.repository';
import { ScanAnalyticsReader } from './scan-analytics-reader';

describe('ScanAnalyticsReader', () => {
  const repository = {
    getSummaryByUser: jest.fn(),
    getMetricsByUser: jest.fn(),
    getQrCodeDetail: jest.fn(),
    listQrCodeScans: jest.fn(),
  };

  const prisma = {
    qrCode: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  let reader: ScanAnalyticsReader;

  beforeEach(() => {
    reader = new ScanAnalyticsReader(
      repository as unknown as ScanEventRepository,
      prisma as unknown as PrismaService,
    );
    jest.clearAllMocks();
  });

  it('deve retornar resumo do usuário', async () => {
    repository.getSummaryByUser.mockResolvedValue({
      totalScans: 10,
      qrCodes: [],
    });

    const result = await reader.getSummary('user-1', {});

    expect(result.totalScans).toBe(10);
  });

  it('deve retornar métricas agregadas', async () => {
    repository.getMetricsByUser.mockResolvedValue({
      totalScans: 10,
      byDevice: {
        mobile: 8,
        desktop: 1,
        tablet: 1,
        unknown: 0,
      },
      byBrowser: { Safari: 8, Chrome: 2 },
      byOperatingSystem: { iOS: 8, Android: 2 },
      byCountry: { Brazil: 10 },
      byState: { 'Sao Paulo': 10 },
      byCity: { 'Sao Paulo': 10 },
      timeline: [{ date: '2026-09-09', totalScans: 10 }],
    });

    const result = await reader.getMetrics('user-1', {});

    expect(result.totalScans).toBe(10);
    expect(result.byDevice.mobile).toBe(8);
    expect(repository.getMetricsByUser).toHaveBeenCalledWith('user-1', {});
  });

  it('deve negar acesso a QR Code de outro usuário', async () => {
    prisma.qrCode.findUnique.mockResolvedValue({
      userId: 'other-user',
    });

    await expect(
      reader.getQrCodeDetail('user-1', 'qr-1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deve retornar 404 para QR Code inexistente', async () => {
    prisma.qrCode.findUnique.mockResolvedValue(null);

    await expect(
      reader.getQrCodeDetail('user-1', 'qr-1', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
