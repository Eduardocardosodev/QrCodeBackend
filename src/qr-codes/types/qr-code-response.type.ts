export type QrCodeResponse = {
  id: string;
  name: string;
  destinationUrl: string;
  address: string | null;
  folder: string;
  color: string;
  isInUse: boolean;
  publicUrl: string;
  createdAt: string;
};
