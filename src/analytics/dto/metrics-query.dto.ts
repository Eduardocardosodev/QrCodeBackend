import { IsOptional, IsUUID } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

export class MetricsQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  qrCodeId?: string;
}
