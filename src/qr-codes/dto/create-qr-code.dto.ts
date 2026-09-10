import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
} from 'class-validator';

const DEFAULT_QR_COLOR = '#000000';

export class CreateQrCodeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  destinationUrl: string;

  @IsString()
  @MinLength(1)
  folder: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color (e.g. #000000)',
  })
  color?: string = DEFAULT_QR_COLOR;
}
