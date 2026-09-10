import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { BatchQrCodeResponse } from '../src/qr-codes/types/batch-qr-code-response.type';
import { FolderResponse } from '../src/qr-codes/types/folder-response.type';
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

    const body = response.body as {
      items: QrCodeResponse[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe('QR A');
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.total).toBe(1);
    expect(body.totalPages).toBe(1);
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

    expect(
      (listResponse.body as { items: QrCodeResponse[] }).items.length,
    ).toBe(0);

    await request(app.getHttpServer()).get(`/redirects/${slug}`).expect(404);

    const scanCount = await prisma.scanEvent.count({
      where: { qrCodeId: createdBody.id },
    });

    expect(scanCount).toBe(0);
  });

  it('GET /folders lista pastas do usuário autenticado', async () => {
    await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'QR Pasta',
        destinationUrl: 'https://example.com/folder',
        folder: 'Clientes',
      });

    const response = await request(app.getHttpServer())
      .get('/folders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as FolderResponse[];

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Clientes');
    expect(body[0].id).toBeDefined();
  });

  it('POST, GET, PATCH e DELETE /folders executam o CRUD completo', async () => {
    const created = await request(app.getHttpServer())
      .post('/folders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: ' Clientes ' })
      .expect(201);

    const createdBody = created.body as FolderResponse;
    expect(createdBody.name).toBe('Clientes');
    expect(createdBody.qrCodeCount).toBe(0);

    const detail = await request(app.getHttpServer())
      .get(`/folders/${createdBody.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((detail.body as FolderResponse).name).toBe('Clientes');

    const updated = await request(app.getHttpServer())
      .patch(`/folders/${createdBody.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Clientes VIP' })
      .expect(200);

    expect((updated.body as FolderResponse).name).toBe('Clientes VIP');

    await request(app.getHttpServer())
      .delete(`/folders/${createdBody.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/folders/${createdBody.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('não permite acessar ou alterar pasta de outro usuário', async () => {
    const created = await request(app.getHttpServer())
      .post('/folders')
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .send({ name: 'Pasta privada' })
      .expect(201);

    const folderId = (created.body as FolderResponse).id;

    await request(app.getHttpServer())
      .get(`/folders/${folderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/folders/${folderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Pasta invadida' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/folders/${folderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('não permite nomes duplicados para o mesmo usuário', async () => {
    await request(app.getHttpServer())
      .post('/folders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Clientes' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/folders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Clientes' })
      .expect(409);
  });

  it('POST /qr-codes/batch cria lote atômico na pasta selecionada', async () => {
    await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Inicial',
        destinationUrl: 'https://example.com/inicial',
        folder: 'Lote',
      });

    const foldersResponse = await request(app.getHttpServer())
      .get('/folders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const folderId = (foldersResponse.body as FolderResponse[])[0].id;

    const batchResponse = await request(app.getHttpServer())
      .post('/qr-codes/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prefix: 'Cliente',
        quantity: 3,
        destinationUrl: 'https://example.com/padrao',
        folderId,
      })
      .expect(201);

    const batchBody = batchResponse.body as BatchQrCodeResponse;

    expect(batchBody.count).toBe(3);
    expect(batchBody.items).toHaveLength(3);
    expect(batchBody.items[0].name).toBe('Cliente 1');
    expect(batchBody.items[2].name).toBe('Cliente 3');
    expect(
      batchBody.items.every(
        (item) => item.destinationUrl === 'https://example.com/padrao',
      ),
    ).toBe(true);
    expect(batchBody.items.every((item) => item.folder === 'Lote')).toBe(true);
    expect(batchBody.items.every((item) => item.color === '#000000')).toBe(
      true,
    );

    const listResponse = await request(app.getHttpServer())
      .get('/qr-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      (listResponse.body as { items: QrCodeResponse[] }).items.length,
    ).toBe(4);
  });

  it('POST /qr-codes/batch rejeita pasta de outro usuário', async () => {
    await request(app.getHttpServer())
      .post('/qr-codes')
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .send({
        name: 'Pasta B',
        destinationUrl: 'https://example.com/b',
        folder: 'Pasta Privada',
      });

    const foldersResponse = await request(app.getHttpServer())
      .get('/folders')
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(200);

    const folderId = (foldersResponse.body as FolderResponse[])[0].id;

    await request(app.getHttpServer())
      .post('/qr-codes/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prefix: 'Cliente',
        quantity: 2,
        destinationUrl: 'https://example.com/padrao',
        folderId,
      })
      .expect(404);
  });

  it('POST /qr-codes/batch valida limite de quantidade', async () => {
    await request(app.getHttpServer())
      .post('/qr-codes/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prefix: 'Cliente',
        quantity: 1001,
        destinationUrl: 'https://example.com/padrao',
        folderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      })
      .expect(400);
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
