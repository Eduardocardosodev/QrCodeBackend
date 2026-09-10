import { ConfigService } from '@nestjs/config';
import { MaxMindIpGeolocator } from './maxmind-ip-geolocator';

describe('MaxMindIpGeolocator', () => {
  const configService = {
    get: jest.fn(() => undefined),
  };

  it('deve retornar null quando base não estiver configurada', async () => {
    const geolocator = new MaxMindIpGeolocator(
      configService as unknown as ConfigService,
    );

    await geolocator.onModuleInit();

    expect(geolocator.locate('8.8.8.8')).toBeNull();
  });

  it('deve retornar null para IP privado', async () => {
    const geolocator = new MaxMindIpGeolocator(
      configService as unknown as ConfigService,
    );

    await geolocator.onModuleInit();

    expect(geolocator.locate('192.168.0.10')).toBeNull();
  });
});
