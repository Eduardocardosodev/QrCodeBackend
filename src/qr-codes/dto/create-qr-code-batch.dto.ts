import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const DEFAULT_QR_COLOR = '#000000';
export const MAX_BATCH_QUANTITY = 1000;

export class CreateQrCodeBatchDto {
  @IsString()
  @MinLength(1)
  prefix: string;

  @IsInt()
  @Min(1)
  @Max(MAX_BATCH_QUANTITY)
  quantity: number;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  destinationUrl: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  address?: string;

  @IsUUID()
  folderId: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color (e.g. #000000)',
  })
  color?: string = DEFAULT_QR_COLOR;
}
