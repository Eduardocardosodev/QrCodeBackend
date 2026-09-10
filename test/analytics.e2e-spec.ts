import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { QrCodeResponse } from '../src/qr-codes/types/qr-code-response.type';
import { PrismaService } from '../src/prisma/prisma.service';
import { isE2EDatabaseAvailable } from './e2e-env';

const describeE2E = isE2EDatabaseAvailable() ? describe : describe.skip;

describeE2E('Analytics (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken = '';
  let otherAccessToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await prisma.scanEvent.deleteMany();
    await prisma.qrCode.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    const userA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'analytics-a@example.com',
        password: 'password123',
      });

    const userB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'analytics-b@example.com',
        password: 'password123',
      });

    accessToken = (userA.body as { accessToken: string }).accessToken;
    otherAccessToken = (userB.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('deve registrar scan ao acessar redirect e expor analytics', async () => {
    const created = await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Analytics QR',
        destinationUrl: 'https://example.com/analytics',
        folder: 'Testes',
      });

    const createdBody = created.body as QrCodeResponse;
    const slug = createdBody.publicUrl.split('/redirects/')[1];

    await request(app.getHttpServer())
      .get(`/redirects/${slug}`)
      .set(
        'User-Agent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      )
      .expect(302);

    const summary = await request(app.getHttpServer())
      .get('/analytics/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((summary.body as { totalScans: number }).totalScans).toBe(1);

    const detail = await request(app.getHttpServer())
      .get(`/analytics/qr-codes/${createdBody.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((detail.body as { totalScans: number }).totalScans).toBe(1);

    const scans = await request(app.getHttpServer())
      .get(`/analytics/qr-codes/${createdBody.id}/scans`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const scansBody = scans.body as {
      items: Array<{ deviceType: string; operatingSystem: string | null }>;
      total: number;
    };

    expect(scansBody.total).toBe(1);
    expect(scansBody.items[0].deviceType).toBe('mobile');
    expect(scansBody.items[0].operatingSystem).toBe('iOS');

    const metrics = await request(app.getHttpServer())
      .get(`/analytics/metrics?qrCodeId=${createdBody.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const metricsBody = metrics.body as {
      totalScans: number;
      byCountry: Record<string, number>;
      byState: Record<string, number>;
      byCity: Record<string, number>;
    };

    expect(metricsBody.totalScans).toBe(1);
    expect(metricsBody.byCountry).toBeDefined();
    expect(metricsBody.byState).toBeDefined();
    expect(metricsBody.byCity).toBeDefined();
  });

  it('deve isolar analytics entre usuários', async () => {
    const created = await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Privado',
        destinationUrl: 'https://example.com/private',
        folder: 'Testes',
      });

    const createdBody = created.body as QrCodeResponse;

    await request(app.getHttpServer())
      .get(`/analytics/qr-codes/${createdBody.id}`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(403);
  });
});
