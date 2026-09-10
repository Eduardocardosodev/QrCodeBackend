import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FoldersService } from './folders.service';

describe('FoldersService', () => {
  let service: FoldersService;

  const prisma = {
    folder: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FoldersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<FoldersService>(FoldersService);
    jest.clearAllMocks();
  });

  it('deve listar pastas do usuário ordenadas por nome', async () => {
    prisma.folder.findMany.mockResolvedValue([
      {
        id: 'folder-2',
        name: 'Marketing',
        createdAt: new Date('2026-03-09T12:00:00.000Z'),
        updatedAt: new Date('2026-03-09T12:00:00.000Z'),
        _count: { qrCodes: 2 },
      },
      {
        id: 'folder-1',
        name: 'Clientes',
        createdAt: new Date('2026-03-09T11:00:00.000Z'),
        updatedAt: new Date('2026-03-09T11:00:00.000Z'),
        _count: { qrCodes: 1 },
      },
    ]);

    const result = await service.findAllByUser('user-1');

    expect(prisma.folder.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { qrCodes: { where: { isActive: true } } },
        },
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Marketing');
    expect(result[0].qrCodeCount).toBe(2);
  });

  it('deve criar uma pasta', async () => {
    const folder = {
      id: 'folder-1',
      name: 'Clientes',
      createdAt: new Date('2026-03-09T11:00:00.000Z'),
      updatedAt: new Date('2026-03-09T11:00:00.000Z'),
      _count: { qrCodes: 0 },
    };
    prisma.folder.create.mockResolvedValue(folder);

    const result = await service.create('user-1', { name: ' Clientes ' });

    expect(prisma.folder.create).toHaveBeenCalledWith({
      data: { name: 'Clientes', userId: 'user-1' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { qrCodes: { where: { isActive: true } } },
        },
      },
    });
    expect(result.name).toBe('Clientes');
  });

  it('deve buscar uma pasta do usuário', async () => {
    prisma.folder.findFirst.mockResolvedValue({
      id: 'folder-1',
      name: 'Clientes',
      createdAt: new Date('2026-03-09T11:00:00.000Z'),
      updatedAt: new Date('2026-03-09T11:00:00.000Z'),
      _count: { qrCodes: 3 },
    });

    const result = await service.findOneByUser('user-1', 'folder-1');

    expect(result.qrCodeCount).toBe(3);
  });

  it('deve atualizar uma pasta do usuário', async () => {
    prisma.folder.findFirst.mockResolvedValue({ id: 'folder-1' });
    prisma.folder.update.mockResolvedValue({
      id: 'folder-1',
      name: 'Clientes VIP',
      createdAt: new Date('2026-03-09T11:00:00.000Z'),
      updatedAt: new Date('2026-03-09T12:00:00.000Z'),
      _count: { qrCodes: 1 },
    });

    const result = await service.update('user-1', 'folder-1', {
      name: ' Clientes VIP ',
    });

    expect(prisma.folder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'folder-1' },
        data: { name: 'Clientes VIP' },
      }),
    );
    expect(result.name).toBe('Clientes VIP');
  });

  it('deve excluir uma pasta do usuário', async () => {
    prisma.folder.findFirst.mockResolvedValue({ id: 'folder-1' });

    await service.remove('user-1', 'folder-1');

    expect(prisma.folder.delete).toHaveBeenCalledWith({
      where: { id: 'folder-1' },
    });
  });
});
