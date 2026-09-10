import { IsUrl } from 'class-validator';

export class UpdateQrCodeDto {
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  destinationUrl: string;
}
