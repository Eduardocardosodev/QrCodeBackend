import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { FolderResponse } from './types/folder-response.type';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUser(userId: string): Promise<FolderResponse[]> {
    const folders = await this.prisma.folder.findMany({
      where: { userId },
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

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
      qrCodeCount: folder._count.qrCodes,
    }));
  }

  async create(userId: string, dto: CreateFolderDto): Promise<FolderResponse> {
    const name = this.normalizeName(dto.name);

    try {
      const folder = await this.prisma.folder.create({
        data: { name, userId },
        select: this.folderSelect(),
      });

      return this.toResponse(folder);
    } catch (error) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  async findOneByUser(userId: string, id: string): Promise<FolderResponse> {
    const folder = await this.prisma.folder.findFirst({
      where: { id, userId },
      select: this.folderSelect(),
    });

    if (!folder) {
      throw new NotFoundException('Pasta não encontrada');
    }

    return this.toResponse(folder);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFolderDto,
  ): Promise<FolderResponse> {
    await this.ensureOwnership(userId, id);

    try {
      const folder = await this.prisma.folder.update({
        where: { id },
        data: { name: this.normalizeName(dto.name) },
        select: this.folderSelect(),
      });

      return this.toResponse(folder);
    } catch (error) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.ensureOwnership(userId, id);
    await this.prisma.folder.delete({ where: { id } });
  }

  private async ensureOwnership(userId: string, id: string): Promise<void> {
    const folder = await this.prisma.folder.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!folder) {
      throw new NotFoundException('Pasta não encontrada');
    }
  }

  private normalizeName(name: string): string {
    return name.trim();
  }

  private throwIfDuplicate(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Já existe uma pasta com este nome');
    }
  }

  private folderSelect() {
    return {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { qrCodes: { where: { isActive: true } } },
      },
    } as const;
  }

  private toResponse(folder: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { qrCodes: number };
  }): FolderResponse {
    return {
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
      qrCodeCount: folder._count.qrCodes,
    };
  }
}
