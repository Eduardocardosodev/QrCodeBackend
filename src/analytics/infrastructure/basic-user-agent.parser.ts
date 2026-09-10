import { Injectable } from '@nestjs/common';
import {
  ParsedUserAgent,
  UserAgentParser,
} from '../domain/contracts/user-agent-parser';
import { DeviceType } from '../domain/types/device-type.type';

@Injectable()
export class BasicUserAgentParser extends UserAgentParser {
  constructor() {
    super();
  }

  parse(userAgent?: string | null): ParsedUserAgent {
    if (!userAgent) {
      return {
        deviceType: 'unknown',
        operatingSystem: null,
        browser: null,
      };
    }

    const normalized = userAgent.toLowerCase();

    return {
      deviceType: this.detectDeviceType(normalized),
      operatingSystem: this.detectOperatingSystem(normalized),
      browser: this.detectBrowser(normalized),
    };
  }

  private detectDeviceType(userAgent: string): DeviceType {
    if (/ipad|tablet|kindle|playbook/.test(userAgent)) {
      return 'tablet';
    }

    if (/mobile|iphone|ipod|android/.test(userAgent)) {
      return 'mobile';
    }

    if (/windows|macintosh|linux|cros/.test(userAgent)) {
      return 'desktop';
    }

    return 'unknown';
  }

  private detectOperatingSystem(userAgent: string): string | null {
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'iOS';
    }

    if (userAgent.includes('android')) {
      return 'Android';
    }

    if (userAgent.includes('windows')) {
      return 'Windows';
    }

    if (userAgent.includes('mac os x') || userAgent.includes('macintosh')) {
      return 'macOS';
    }

    if (userAgent.includes('linux')) {
      return 'Linux';
    }

    return null;
  }

  private detectBrowser(userAgent: string): string | null {
    if (userAgent.includes('edg/')) {
      return 'Edge';
    }

    if (userAgent.includes('chrome/') && !userAgent.includes('edg/')) {
      return 'Chrome';
    }

    if (userAgent.includes('safari/') && !userAgent.includes('chrome/')) {
      return 'Safari';
    }

    if (userAgent.includes('firefox/')) {
      return 'Firefox';
    }

    return null;
  }
}
