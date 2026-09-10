import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { QrCodesController } from './qr-codes.controller';
import { QrCodesService } from './qr-codes.service';
import { RedirectsController } from './redirects.controller';

@Module({
  imports: [AnalyticsModule],
  controllers: [QrCodesController, FoldersController, RedirectsController],
  providers: [QrCodesService, FoldersService],
  exports: [QrCodesService, FoldersService],
})
export class QrCodesModule {}
