import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { IpAnonymizer } from '../domain/contracts/ip-anonymizer';

@Injectable()
export class Sha256IpAnonymizer extends IpAnonymizer {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  anonymize(ipAddress?: string | null): string | null {
    if (!ipAddress?.trim()) {
      return null;
    }

    const secret = this.configService.getOrThrow<string>(
      'SCAN_EVENTS_IP_HASH_SECRET',
    );

    return createHash('sha256')
      .update(`${ipAddress.trim()}:${secret}`)
      .digest('hex');
  }
}
