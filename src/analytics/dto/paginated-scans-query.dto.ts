import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

export class PaginatedScansQueryDto extends DateRangeQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
