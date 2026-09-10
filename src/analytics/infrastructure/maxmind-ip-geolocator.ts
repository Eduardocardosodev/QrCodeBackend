import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import maxmind, { CityResponse, Reader } from 'maxmind';
import { IpGeolocator, GeoLocation } from '../domain/contracts/ip-geolocator';
import { isPrivateIp } from '../utils/is-private-ip.util';

@Injectable()
export class MaxMindIpGeolocator extends IpGeolocator implements OnModuleInit {
  private readonly logger = new Logger(MaxMindIpGeolocator.name);
  private reader: Reader<CityResponse> | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const dbPath = this.configService.get<string>('GEOLITE2_CITY_DB_PATH');

    if (!dbPath) {
      this.logger.warn(
        'GEOLITE2_CITY_DB_PATH não configurado. Geolocalização desabilitada.',
      );
      return;
    }

    try {
      this.reader = await maxmind.open<CityResponse>(dbPath);
      this.logger.log(`Base GeoLite2 carregada em ${dbPath}`);
    } catch (error) {
      this.logger.warn(
        `Não foi possível abrir base GeoLite2 em ${dbPath}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    }
  }

  locate(ipAddress?: string | null): GeoLocation | null {
    if (!ipAddress || !this.reader || isPrivateIp(ipAddress)) {
      return null;
    }

    try {
      const result = this.reader.get(ipAddress);

      if (!result) {
        return null;
      }

      return {
        country: result.country?.names?.en ?? result.country?.iso_code ?? null,
        state:
          result.subdivisions?.[0]?.names?.en ??
          result.subdivisions?.[0]?.iso_code ??
          null,
        city: result.city?.names?.en ?? null,
      };
    } catch {
      return null;
    }
  }
}
