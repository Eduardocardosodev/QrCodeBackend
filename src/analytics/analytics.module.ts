import { Module } from '@nestjs/common';
import { ScanAnalyticsReader } from './application/scan-analytics-reader';
import { ScanEventRecorder } from './application/scan-event-recorder';
import { AnalyticsController } from './analytics.controller';
import { IpGeolocator } from './domain/contracts/ip-geolocator';
import { IpAnonymizer } from './domain/contracts/ip-anonymizer';
import { MaxMindIpGeolocator } from './infrastructure/maxmind-ip-geolocator';
import { ScanEventRepository } from './domain/contracts/scan-event.repository';
import { UserAgentParser } from './domain/contracts/user-agent-parser';
import { BasicUserAgentParser } from './infrastructure/basic-user-agent.parser';
import { PrismaScanEventRepository } from './infrastructure/prisma-scan-event.repository';
import { Sha256IpAnonymizer } from './infrastructure/sha256-ip-anonymizer';

@Module({
  controllers: [AnalyticsController],
  providers: [
    ScanEventRecorder,
    ScanAnalyticsReader,
    {
      provide: ScanEventRepository,
      useClass: PrismaScanEventRepository,
    },
    {
      provide: UserAgentParser,
      useClass: BasicUserAgentParser,
    },
    {
      provide: IpAnonymizer,
      useClass: Sha256IpAnonymizer,
    },
    {
      provide: IpGeolocator,
      useClass: MaxMindIpGeolocator,
    },
  ],
  exports: [ScanEventRecorder, ScanAnalyticsReader],
})
export class AnalyticsModule {}
