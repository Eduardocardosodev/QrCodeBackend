import { QrCodeResponse } from './qr-code-response.type';

export type PaginatedQrCodesResponse = {
  items: QrCodeResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
