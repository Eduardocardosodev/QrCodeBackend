import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { QrCodesService } from './qr-codes.service';

describe('QrCodesService', () => {
  let service: QrCodesService;

  const prisma = {
    qrCode: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    folder: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
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
    address: null,
    color: '#000000',
    isActive: true,
    isInUse: false,
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
      async (
        input:
          ((tx: typeof prisma) => Promise<unknown>) | Array<Promise<unknown>>,
      ) => (typeof input === 'function' ? input(prisma) : Promise.all(input)),
    );
  });

  it('deve listar QR Codes do usuário', async () => {
    prisma.qrCode.count.mockResolvedValue(1);
    prisma.qrCode.findMany.mockResolvedValue([qrCode]);

    const result = await service.findAllByUser(userId, {
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual({
      id: qrCode.id,
      name: qrCode.name,
      destinationUrl: qrCode.destinationUrl,
      address: null,
      folder: 'Clientes',
      color: '#000000',
      isInUse: false,
      publicUrl: 'http://localhost:3000/redirects/abc12345',
      createdAt: qrCode.createdAt.toISOString(),
    });
  });

  it('deve filtrar QR Codes por isInUse', async () => {
    prisma.qrCode.count.mockResolvedValue(1);
    prisma.qrCode.findMany.mockResolvedValue([{ ...qrCode, isInUse: true }]);

    const result = await service.findAllByUser(userId, {
      page: 1,
      limit: 20,
      isInUse: true,
    });

    expect(prisma.qrCode.findMany).toHaveBeenCalledWith({
      where: { userId, isActive: true, isInUse: true },
      include: { folder: true },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result.items[0].isInUse).toBe(true);
  });

  it('deve paginar QR Codes e calcular total de páginas', async () => {
    prisma.qrCode.count.mockResolvedValue(45);
    prisma.qrCode.findMany.mockResolvedValue([]);

    const result = await service.findAllByUser(userId, {
      page: 2,
      limit: 20,
    });

    expect(prisma.qrCode.findMany).toHaveBeenCalledWith({
      where: { userId, isActive: true },
      include: { folder: true },
      orderBy: { createdAt: 'desc' },
      skip: 20,
      take: 20,
    });
    expect(result).toEqual({
      items: [],
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
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

  it('deve criar QR Code com endereço', async () => {
    prisma.folder.upsert.mockResolvedValue(qrCode.folder);
    prisma.qrCode.findUnique.mockResolvedValue(null);
    prisma.qrCode.create.mockResolvedValue({
      ...qrCode,
      address: 'Rua Principal, 100',
    });

    await service.create(userId, {
      name: 'Cardápio',
      destinationUrl: 'https://example.com',
      address: ' Rua Principal, 100 ',
      folder: 'Clientes',
    });

    const createCalls = prisma.qrCode.create.mock.calls as Array<
      [{ data: { address: string } }]
    >;

    expect(createCalls[0]?.[0].data.address).toBe('Rua Principal, 100');
  });

  it('deve atualizar destinationUrl do QR Code do usuário', async () => {
    prisma.qrCode.findUnique.mockResolvedValue(qrCode);
    prisma.qrCode.update.mockResolvedValue({
      ...qrCode,
      destinationUrl: 'https://novo-destino.com',
    });

    const result = await service.update(userId, qrCode.id, {
      destinationUrl: 'https://novo-destino.com',
    });

    expect(result.destinationUrl).toBe('https://novo-destino.com');
    expect(result.isInUse).toBe(false);
  });

  it('deve atualizar isInUse sem alterar isActive', async () => {
    prisma.qrCode.findUnique.mockResolvedValue(qrCode);
    prisma.qrCode.update.mockResolvedValue({
      ...qrCode,
      isInUse: true,
    });

    const result = await service.update(userId, qrCode.id, {
      isInUse: true,
    });

    expect(prisma.qrCode.update).toHaveBeenCalledWith({
      where: { id: qrCode.id },
      data: { isInUse: true },
      include: { folder: true },
    });
    expect(result.isInUse).toBe(true);
  });

  it('deve atualizar nome e endereço do QR Code', async () => {
    prisma.qrCode.findUnique.mockResolvedValue(qrCode);
    prisma.qrCode.update.mockResolvedValue({
      ...qrCode,
      name: 'Unidade Centro',
      address: 'Avenida Central, 200',
    });

    const result = await service.update(userId, qrCode.id, {
      name: ' Unidade Centro ',
      address: ' Avenida Central, 200 ',
    });

    expect(prisma.qrCode.update).toHaveBeenCalledWith({
      where: { id: qrCode.id },
      data: {
        name: 'Unidade Centro',
        address: 'Avenida Central, 200',
      },
      include: { folder: true },
    });
    expect(result.name).toBe('Unidade Centro');
    expect(result.address).toBe('Avenida Central, 200');
  });

  it('deve rejeitar atualização sem campos', async () => {
    prisma.qrCode.findUnique.mockResolvedValue(qrCode);

    await expect(service.update(userId, qrCode.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('deve negar atualização de QR Code de outro usuário', async () => {
    prisma.qrCode.findUnique.mockResolvedValue({
      ...qrCode,
      userId: 'outro-usuario',
    });

    await expect(
      service.update(userId, qrCode.id, {
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

  it('deve criar lote com nomes sequenciais e mesma URL, pasta e cor', async () => {
    prisma.folder.findFirst.mockResolvedValue(qrCode.folder);
    prisma.qrCode.findMany.mockImplementation(
      ({
        include,
        where,
      }: {
        include?: { folder: boolean };
        where: { slug: { in: string[] } };
      }) =>
        include
          ? Promise.resolve(
              where.slug.in.map((slug, index) => ({
                ...qrCode,
                id: `qr-${index + 1}`,
                name: `Cliente ${index + 1}`,
                slug,
                destinationUrl: 'https://example.com/padrao',
              })),
            )
          : Promise.resolve([]),
    );
    prisma.qrCode.createMany.mockResolvedValue({ count: 3 });

    const result = await service.createBatch(userId, {
      prefix: 'Cliente',
      quantity: 3,
      destinationUrl: 'https://example.com/padrao',
      folderId: 'folder-1',
    });

    expect(result.count).toBe(3);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].name).toBe('Cliente 1');
    expect(result.items[2].name).toBe('Cliente 3');
    expect(
      result.items.every(
        (item) => item.destinationUrl === 'https://example.com/padrao',
      ),
    ).toBe(true);
    expect(result.items.every((item) => item.folder === 'Clientes')).toBe(true);
    expect(result.items.every((item) => item.color === '#000000')).toBe(true);
  });

  it('deve retornar 404 para pasta de outro usuário no lote', async () => {
    prisma.folder.findFirst.mockResolvedValue(null);

    await expect(
      service.createBatch(userId, {
        prefix: 'Cliente',
        quantity: 2,
        destinationUrl: 'https://example.com/padrao',
        folderId: 'folder-outro-usuario',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deve propagar erro e não concluir lote quando criação falhar', async () => {
    prisma.folder.findFirst.mockResolvedValue(qrCode.folder);
    prisma.qrCode.findMany.mockResolvedValue([]);
    prisma.qrCode.createMany.mockRejectedValue(new Error('falha no banco'));

    await expect(
      service.createBatch(userId, {
        prefix: 'Cliente',
        quantity: 2,
        destinationUrl: 'https://example.com/padrao',
        folderId: 'folder-1',
      }),
    ).rejects.toThrow('falha no banco');
  });
});
