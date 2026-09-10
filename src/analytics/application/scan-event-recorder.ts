import { Injectable, Logger } from '@nestjs/common';
import { ScanEventRepository } from '../domain/contracts/scan-event.repository';
import { IpGeolocator } from '../domain/contracts/ip-geolocator';
import { IpAnonymizer } from '../domain/contracts/ip-anonymizer';
import { UserAgentParser } from '../domain/contracts/user-agent-parser';
import { ScanRequestContext } from '../domain/types/scan-event.types';

@Injectable()
export class ScanEventRecorder {
  private readonly logger = new Logger(ScanEventRecorder.name);

  constructor(
    private readonly scanEventRepository: ScanEventRepository,
    private readonly userAgentParser: UserAgentParser,
    private readonly ipAnonymizer: IpAnonymizer,
    private readonly ipGeolocator: IpGeolocator,
  ) {}

  async recordFromSlug(
    slug: string,
    context: ScanRequestContext,
  ): Promise<void> {
    try {
      const qrCodeId = await this.scanEventRepository.findQrCodeIdBySlug(slug);

      if (!qrCodeId) {
        return;
      }

      const parsedUserAgent = this.userAgentParser.parse(context.userAgent);
      const geoLocation = this.ipGeolocator.locate(context.ipAddress);

      await this.scanEventRepository.create({
        qrCodeId,
        ipHash: this.ipAnonymizer.anonymize(context.ipAddress),
        userAgent: context.userAgent ?? null,
        deviceType: parsedUserAgent.deviceType,
        operatingSystem: parsedUserAgent.operatingSystem,
        browser: parsedUserAgent.browser,
        referer: context.referer ?? null,
        country: geoLocation?.country ?? null,
        state: geoLocation?.state ?? null,
        city: geoLocation?.city ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar scan para slug ${slug}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    }
  }
}
