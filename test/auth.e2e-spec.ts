import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthResponse } from '../src/auth/types/auth-response.type';
import { PrismaService } from '../src/prisma/prisma.service';
import { isE2EDatabaseAvailable } from './e2e-env';

const describeE2E = isE2EDatabaseAvailable() ? describe : describe.skip;

describeE2E('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register cria conta e retorna tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
      })
      .expect(201);

    const body = response.body as AuthResponse;

    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
  });

  it('POST /auth/login autentica usuário existente', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'login@example.com',
      password: 'password123',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'login@example.com',
        password: 'password123',
      })
      .expect(200);

    const body = response.body as AuthResponse;

    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('GET /auth/me exige bearer token', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'me@example.com',
        password: 'password123',
      });

    const registerBody = registerResponse.body as AuthResponse;

    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${registerBody.accessToken}`)
      .expect(200);

    expect((meResponse.body as { email: string }).email).toBe('me@example.com');
  });

  it('POST /auth/refresh rotaciona tokens', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'refresh@example.com',
        password: 'password123',
      });

    const registerBody = registerResponse.body as AuthResponse;
    const oldRefreshToken = registerBody.refreshToken;

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(200);

    const refreshBody = refreshResponse.body as AuthResponse;

    expect(refreshBody.accessToken).toBeDefined();
    expect(refreshBody.refreshToken).toBeDefined();
    expect(refreshBody.refreshToken).not.toBe(oldRefreshToken);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);
  });

  it('POST /auth/logout revoga refresh token', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'logout@example.com',
        password: 'password123',
      });

    const registerBody = registerResponse.body as AuthResponse;
    const refreshToken = registerBody.refreshToken;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
