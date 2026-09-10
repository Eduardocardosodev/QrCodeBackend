import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const jwtService = {
    signAsync: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return values[key];
    }),
  };

  const user = {
    id: 'user-id',
    email: 'user@example.com',
    passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    user.passwordHash = await bcrypt.hash('password123', 12);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    jwtService.signAsync.mockResolvedValue('access-token');
  });

  describe('register', () => {
    it('deve criar usuário e retornar tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'User@Example.com',
        password: 'password123',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'user@example.com',
          passwordHash: expect.any(String) as string,
        },
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('user@example.com');
    });

    it('deve lançar conflito quando email já existe', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.register({
          email: 'user@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('deve autenticar com credenciais válidas', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.user.id).toBe(user.id);
    });

    it('deve rejeitar credenciais inválidas', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('deve rotacionar refresh token válido', async () => {
      const refreshToken = 'valid-refresh-token';
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-id',
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        user,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh(refreshToken);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-id' },
        data: { revokedAt: expect.any(Date) as Date },
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(refreshToken);
    });

    it('deve rejeitar refresh token revogado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-id',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user,
      });

      await expect(service.refresh('revoked-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('deve revogar refresh token válido', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-id',
        revokedAt: null,
      });
      prisma.refreshToken.update.mockResolvedValue({});

      await service.logout('valid-refresh-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-id' },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });
});
