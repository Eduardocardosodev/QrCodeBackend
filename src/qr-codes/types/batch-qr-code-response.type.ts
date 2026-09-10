import { QrCodeResponse } from './qr-code-response.type';

export type BatchQrCodeResponse = {
  count: number;
  items: QrCodeResponse[];
};
