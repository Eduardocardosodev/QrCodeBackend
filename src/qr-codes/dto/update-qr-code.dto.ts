import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateQrCodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ValidateIf((dto: UpdateQrCodeDto) => dto.destinationUrl !== undefined)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  destinationUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  address?: string;

  @IsOptional()
  @IsBoolean()
  isInUse?: boolean;
}
