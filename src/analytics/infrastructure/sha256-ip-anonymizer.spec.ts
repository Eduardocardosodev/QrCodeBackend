import { ConfigService } from '@nestjs/config';
import { Sha256IpAnonymizer } from './sha256-ip-anonymizer';

describe('Sha256IpAnonymizer', () => {
  const configService = {
    getOrThrow: jest.fn(() => 'test-secret'),
  };

  const anonymizer = new Sha256IpAnonymizer(
    configService as unknown as ConfigService,
  );

  it('deve gerar hash para IP válido', () => {
    const hash = anonymizer.anonymize('192.168.0.10');

    expect(hash).toBeTruthy();
    expect(hash).toHaveLength(64);
  });

  it('deve retornar null para IP ausente', () => {
    expect(anonymizer.anonymize(null)).toBeNull();
    expect(anonymizer.anonymize('')).toBeNull();
  });
});
