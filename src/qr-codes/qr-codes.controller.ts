import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateQrCodeBatchDto } from './dto/create-qr-code-batch.dto';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import { PaginatedQrCodesQueryDto } from './dto/paginated-qr-codes-query.dto';
import { UpdateQrCodeDto } from './dto/update-qr-code.dto';
import { QrCodesService } from './qr-codes.service';

@Controller('qr-codes')
@UseGuards(JwtAuthGuard)
export class QrCodesController {
  constructor(private readonly qrCodesService: QrCodesService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginatedQrCodesQueryDto,
  ) {
    return this.qrCodesService.findAllByUser(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQrCodeDto) {
    return this.qrCodesService.create(user.id, dto);
  }

  @Post('batch')
  createBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQrCodeBatchDto,
  ) {
    return this.qrCodesService.createBatch(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateQrCodeDto,
  ) {
    return this.qrCodesService.updateDestination(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.qrCodesService.softDelete(user.id, id);
  }
}
