import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ScanEventRecorder } from '../analytics/application/scan-event-recorder';
import { buildScanRequestContext } from '../analytics/utils/request-context.util';
import { QrCodesService } from './qr-codes.service';

@Controller('redirects')
export class RedirectsController {
  constructor(
    private readonly qrCodesService: QrCodesService,
    private readonly scanEventRecorder: ScanEventRecorder,
  ) {}

  @Get(':slug')
  async redirect(
    @Param('slug') slug: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    await this.scanEventRecorder.recordFromSlug(
      slug,
      buildScanRequestContext(request),
    );

    const destinationUrl = await this.qrCodesService.resolveRedirect(slug);
    return response.redirect(302, destinationUrl);
  }
}
