import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { QrCodeResponse } from '../src/qr-codes/types/qr-code-response.type';
import { PrismaService } from '../src/prisma/prisma.service';
import { isE2EDatabaseAvailable } from './e2e-env';

const describeE2E = isE2EDatabaseAvailable() ? describe : describe.skip;

describeE2E('QrCodes (e2e)', () => {
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
    await prisma.qrCode.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    const userA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'qrcodes-a@example.com',
        password: 'password123',
      });

    const userB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'qrcodes-b@example.com',
        password: 'password123',
      });

    accessToken = (userA.body as { accessToken: string }).accessToken;
    otherAccessToken = (userB.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /qr-codes cria QR Code autenticado', async () => {
    const response = await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Cardápio',
        destinationUrl: 'https://example.com/menu',
        folder: 'Clientes',
      })
      .expect(201);

    const body = response.body as QrCodeResponse;

    expect(body.name).toBe('Cardápio');
    expect(body.folder).toBe('Clientes');
    expect(body.color).toBe('#000000');
    expect(body.publicUrl).toContain('/redirects/');
  });

  it('GET /qr-codes lista apenas QR Codes do usuário autenticado', async () => {
    await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'QR A',
        destinationUrl: 'https://example.com/a',
        folder: 'Pasta A',
      });

    await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .send({
        name: 'QR B',
        destinationUrl: 'https://example.com/b',
        folder: 'Pasta B',
      });

    const response = await request(app.getHttpServer())
      .get('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as QrCodeResponse[];

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('QR A');
  });

  it('PATCH /qr-codes/:id atualiza destinationUrl', async () => {
    const created = await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Landing',
        destinationUrl: 'https://example.com/old',
        folder: 'Marketing',
      });

    const createdBody = created.body as QrCodeResponse;

    const updated = await request(app.getHttpServer())
      .patch(`/qr-codes/${createdBody.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        destinationUrl: 'https://example.com/new',
      })
      .expect(200);

    const updatedBody = updated.body as QrCodeResponse;

    expect(updatedBody.destinationUrl).toBe('https://example.com/new');
    expect(updatedBody.publicUrl).toBe(createdBody.publicUrl);
  });

  it('DELETE /qr-codes/:id faz soft delete e bloqueia redirect', async () => {
    const created = await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Excluir',
        destinationUrl: 'https://example.com/delete',
        folder: 'Testes',
      });

    const createdBody = created.body as QrCodeResponse;
    const slug = createdBody.publicUrl.split('/redirects/')[1];

    await request(app.getHttpServer())
      .delete(`/qr-codes/${createdBody.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const listResponse = await request(app.getHttpServer())
      .get('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((listResponse.body as QrCodeResponse[]).length).toBe(0);

    await request(app.getHttpServer()).get(`/redirects/${slug}`).expect(404);

    const scanCount = await prisma.scanEvent.count({
      where: { qrCodeId: createdBody.id },
    });

    expect(scanCount).toBe(0);
  });

  it('GET /redirects/:slug redireciona para destinationUrl', async () => {
    const created = await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Redirect',
        destinationUrl: 'https://example.com/destino',
        folder: 'Público',
      });

    const createdBody = created.body as QrCodeResponse;
    const slug = createdBody.publicUrl.split('/redirects/')[1];

    const response = await request(app.getHttpServer())
      .get(`/redirects/${slug}`)
      .expect(302);

    expect(response.headers.location).toBe('https://example.com/destino');
  });
});
