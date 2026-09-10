import { ScanEventRepository } from '../domain/contracts/scan-event.repository';
import type { UserAgentParser } from '../domain/contracts/user-agent-parser';
import { ScanEventRecorder } from './scan-event-recorder';

describe('ScanEventRecorder', () => {
  const repository = {
    findQrCodeIdBySlug: jest.fn(),
    create: jest.fn(),
  };

  const userAgentParser = {
    parse: jest.fn(() => ({
      deviceType: 'mobile',
      operatingSystem: 'iOS',
      browser: 'Safari',
    })),
  };

  const ipAnonymizer = {
    anonymize: jest.fn(() => 'hashed-ip'),
  };

  const ipGeolocator = {
    locate: jest.fn(() => ({
      country: 'Brazil',
      state: 'Sao Paulo',
      city: 'Sao Paulo',
    })),
  };

  let recorder: ScanEventRecorder;

  beforeEach(() => {
    recorder = new ScanEventRecorder(
      repository as unknown as ScanEventRepository,
      userAgentParser as unknown as UserAgentParser,
      ipAnonymizer,
      ipGeolocator,
    );
    jest.clearAllMocks();
  });

  it('deve registrar evento quando slug existir', async () => {
    repository.findQrCodeIdBySlug.mockResolvedValue('qr-1');

    await recorder.recordFromSlug('abc12345', {
      ipAddress: '192.168.0.10',
      userAgent: 'iphone',
      referer: 'https://example.com',
    });

    expect(repository.create).toHaveBeenCalledWith({
      qrCodeId: 'qr-1',
      ipHash: 'hashed-ip',
      userAgent: 'iphone',
      deviceType: 'mobile',
      operatingSystem: 'iOS',
      browser: 'Safari',
      referer: 'https://example.com',
      country: 'Brazil',
      state: 'Sao Paulo',
      city: 'Sao Paulo',
    });
  });

  it('não deve lançar erro quando persistência falhar', async () => {
    repository.findQrCodeIdBySlug.mockResolvedValue('qr-1');
    repository.create.mockRejectedValue(new Error('db down'));

    await expect(
      recorder.recordFromSlug('abc12345', {
        ipAddress: '192.168.0.10',
      }),
    ).resolves.toBeUndefined();
  });
});
