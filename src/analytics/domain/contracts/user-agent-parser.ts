import { DeviceType } from '../types/device-type.type';

export type ParsedUserAgent = {
  deviceType: DeviceType;
  operatingSystem: string | null;
  browser: string | null;
};

export abstract class UserAgentParser {
  abstract parse(userAgent?: string | null): ParsedUserAgent;
}
