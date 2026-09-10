import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { QrCodesController } from './qr-codes.controller';
import { QrCodesService } from './qr-codes.service';
import { RedirectsController } from './redirects.controller';

@Module({
  imports: [AnalyticsModule],
  controllers: [QrCodesController, RedirectsController],
  providers: [QrCodesService],
  exports: [QrCodesService],
})
export class QrCodesModule {}
