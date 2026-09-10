import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ScanAnalyticsReader } from './application/scan-analytics-reader';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { MetricsQueryDto } from './dto/metrics-query.dto';
import { PaginatedScansQueryDto } from './dto/paginated-scans-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly scanAnalyticsReader: ScanAnalyticsReader) {}

  @Get('summary')
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.scanAnalyticsReader.getSummary(user.id, {
      from: query.from,
      to: query.to,
    });
  }

  @Get('metrics')
  getMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MetricsQueryDto,
  ) {
    return this.scanAnalyticsReader.getMetrics(user.id, {
      qrCodeId: query.qrCodeId,
      from: query.from,
      to: query.to,
    });
  }

  @Get('qr-codes/:id')
  getQrCodeDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.scanAnalyticsReader.getQrCodeDetail(user.id, id, {
      from: query.from,
      to: query.to,
    });
  }

  @Get('qr-codes/:id/scans')
  listQrCodeScans(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: PaginatedScansQueryDto,
  ) {
    return this.scanAnalyticsReader.listQrCodeScans(
      user.id,
      id,
      {
        from: query.from,
        to: query.to,
      },
      {
        page: query.page,
        limit: query.limit,
      },
    );
  }
}
