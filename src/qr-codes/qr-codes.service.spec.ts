import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { QrCodesService } from './qr-codes.service';

describe('QrCodesService', () => {
  let service: QrCodesService;

  const prisma = {
    qrCode: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    folder: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn(() => 'http://localhost:3000'),
  };

  const userId = 'user-1';
  const qrCode = {
    id: 'qr-1',
    name: 'Cardápio',
    slug: 'abc12345',
    destinationUrl: 'https://example.com',
    color: '#000000',
    isActive: true,
    userId,
    folderId: 'folder-1',
    createdAt: new Date('2026-03-09T12:00:00.000Z'),
    updatedAt: new Date('2026-03-09T12:00:00.000Z'),
    folder: {
      id: 'folder-1',
      name: 'Clientes',
      userId,
      createdAt: new Date('2026-03-09T12:00:00.000Z'),
      updatedAt: new Date('2026-03-09T12:00:00.000Z'),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrCodesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<QrCodesService>(QrCodesService);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
  });

  it('deve listar QR Codes do usuário', async () => {
    prisma.qrCode.findMany.mockResolvedValue([qrCode]);

    const result = await service.findAllByUser(userId);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: qrCode.id,
      name: qrCode.name,
      destinationUrl: qrCode.destinationUrl,
      folder: 'Clientes',
      color: '#000000',
      publicUrl: 'http://localhost:3000/redirects/abc12345',
      createdAt: qrCode.createdAt.toISOString(),
    });
  });

  it('deve criar QR Code com pasta reutilizada', async () => {
    prisma.folder.upsert.mockResolvedValue(qrCode.folder);
    prisma.qrCode.findUnique.mockResolvedValue(null);
    prisma.qrCode.create.mockResolvedValue(qrCode);

    const result = await service.create(userId, {
      name: 'Cardápio',
      destinationUrl: 'https://example.com',
      folder: 'Clientes',
    });

    expect(prisma.folder.upsert).toHaveBeenCalled();
    expect(result.publicUrl).toContain('/redirects/');
    expect(result.folder).toBe('Clientes');
  });

  it('deve atualizar destinationUrl do QR Code do usuário', async () => {
    prisma.qrCode.findUnique.mockResolvedValue(qrCode);
    prisma.qrCode.update.mockResolvedValue({
      ...qrCode,
      destinationUrl: 'https://novo-destino.com',
    });

    const result = await service.updateDestination(userId, qrCode.id, {
      destinationUrl: 'https://novo-destino.com',
    });

    expect(result.destinationUrl).toBe('https://novo-destino.com');
  });

  it('deve negar atualização de QR Code de outro usuário', async () => {
    prisma.qrCode.findUnique.mockResolvedValue({
      ...qrCode,
      userId: 'outro-usuario',
    });

    await expect(
      service.updateDestination(userId, qrCode.id, {
        destinationUrl: 'https://novo-destino.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deve resolver redirect por slug', async () => {
    prisma.qrCode.findUnique.mockResolvedValue(qrCode);

    const destination = await service.resolveRedirect('abc12345');

    expect(destination).toBe('https://example.com');
  });

  it('deve retornar 404 para slug inexistente', async () => {
    prisma.qrCode.findUnique.mockResolvedValue(null);

    await expect(service.resolveRedirect('inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
