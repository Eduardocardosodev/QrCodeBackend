import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Folder, Prisma, QrCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQrCodeBatchDto } from './dto/create-qr-code-batch.dto';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import { PaginatedQrCodesQueryDto } from './dto/paginated-qr-codes-query.dto';
import { UpdateQrCodeDto } from './dto/update-qr-code.dto';
import { BatchQrCodeResponse } from './types/batch-qr-code-response.type';
import { PaginatedQrCodesResponse } from './types/paginated-qr-codes-response.type';
import { QrCodeResponse } from './types/qr-code-response.type';
import { buildPublicUrl } from './utils/public-url.util';
import { generateSlug } from './utils/slug.util';

const DEFAULT_QR_COLOR = '#000000';
const MAX_SLUG_ATTEMPTS = 5;
const MAX_BATCH_SLUG_ATTEMPTS = 20;

type QrCodeWithFolder = QrCode & {
  folder: Folder | null;
};

@Injectable()
export class QrCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findAllByUser(
    userId: string,
    query: PaginatedQrCodesQueryDto,
  ): Promise<PaginatedQrCodesResponse> {
    const where: Prisma.QrCodeWhereInput = { userId, isActive: true };

    if (query.isInUse !== undefined) {
      where.isInUse = query.isInUse;
    }

    const skip = (query.page - 1) * query.limit;

    const [total, qrCodes] = await this.prisma.$transaction([
      this.prisma.qrCode.count({ where }),
      this.prisma.qrCode.findMany({
        where,
        include: { folder: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    return {
      items: qrCodes.map((qrCode) => this.toResponse(qrCode)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async create(userId: string, dto: CreateQrCodeDto): Promise<QrCodeResponse> {
    const folderName = this.normalizeFolderName(dto.folder);
    const slug = await this.generateUniqueSlug();

    const qrCode = await this.prisma.$transaction(async (tx) => {
      const folder = await tx.folder.upsert({
        where: {
          userId_name: {
            userId,
            name: folderName,
          },
        },
        update: {},
        create: {
          userId,
          name: folderName,
        },
      });

      return tx.qrCode.create({
        data: {
          name: dto.name.trim(),
          slug,
          destinationUrl: dto.destinationUrl.trim(),
          address: dto.address?.trim() ?? null,
          color: dto.color ?? DEFAULT_QR_COLOR,
          userId,
          folderId: folder.id,
        },
        include: { folder: true },
      });
    });

    return this.toResponse(qrCode);
  }

  async createBatch(
    userId: string,
    dto: CreateQrCodeBatchDto,
  ): Promise<BatchQrCodeResponse> {
    const folder = await this.prisma.folder.findFirst({
      where: {
        id: dto.folderId,
        userId,
      },
    });

    if (!folder) {
      throw new NotFoundException('Pasta não encontrada');
    }

    const prefix = dto.prefix.trim();
    const destinationUrl = dto.destinationUrl.trim();
    const address = dto.address?.trim() ?? null;
    const color = dto.color ?? DEFAULT_QR_COLOR;

    const items = await this.prisma.$transaction(async (tx) => {
      const slugs = await this.generateUniqueSlugs(dto.quantity, tx);

      await tx.qrCode.createMany({
        data: slugs.map((slug, index) => ({
          name: `${prefix} ${index + 1}`,
          slug,
          destinationUrl,
          address,
          color,
          userId,
          folderId: folder.id,
        })),
      });

      const created = await tx.qrCode.findMany({
        where: { slug: { in: slugs } },
        include: { folder: true },
      });
      const createdBySlug = new Map(
        created.map((qrCode) => [qrCode.slug, qrCode]),
      );

      return slugs.map((slug) => {
        const qrCode = createdBySlug.get(slug);

        if (!qrCode) {
          throw new Error(`QR Code criado não encontrado: ${slug}`);
        }

        return qrCode;
      });
    });

    return {
      count: items.length,
      items: items.map((qrCode) => this.toResponse(qrCode)),
    };
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const qrCode = await this.findOwnedQrCode(userId, id);

    if (!qrCode.isActive) {
      return;
    }

    await this.prisma.qrCode.update({
      where: { id: qrCode.id },
      data: { isActive: false },
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateQrCodeDto,
  ): Promise<QrCodeResponse> {
    if (
      dto.name === undefined &&
      dto.destinationUrl === undefined &&
      dto.address === undefined &&
      dto.isInUse === undefined
    ) {
      throw new BadRequestException(
        'Informe name, destinationUrl, address ou isInUse para atualizar o QR Code',
      );
    }

    const qrCode = await this.findOwnedQrCode(userId, id, {
      requireActive: true,
    });

    const data: Prisma.QrCodeUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.destinationUrl !== undefined) {
      data.destinationUrl = dto.destinationUrl.trim();
    }

    if (dto.address !== undefined) {
      data.address = dto.address.trim();
    }

    if (dto.isInUse !== undefined) {
      data.isInUse = dto.isInUse;
    }

    const updated = await this.prisma.qrCode.update({
      where: { id: qrCode.id },
      data,
      include: { folder: true },
    });

    return this.toResponse(updated);
  }

  async resolveRedirect(slug: string): Promise<string> {
    const qrCode = await this.prisma.qrCode.findUnique({
      where: { slug },
    });

    if (!qrCode || !qrCode.isActive) {
      throw new NotFoundException('QR Code não encontrado');
    }

    return qrCode.destinationUrl;
  }

  private async findOwnedQrCode(
    userId: string,
    id: string,
    options?: { requireActive?: boolean },
  ): Promise<QrCodeWithFolder> {
    const qrCode = await this.prisma.qrCode.findUnique({
      where: { id },
      include: { folder: true },
    });

    if (!qrCode) {
      throw new NotFoundException('QR Code não encontrado');
    }

    if (qrCode.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão para este QR Code');
    }

    if (options?.requireActive && !qrCode.isActive) {
      throw new NotFoundException('QR Code não encontrado');
    }

    return qrCode;
  }

  private async generateUniqueSlug(
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const slug = generateSlug();
      const existing = await client.qrCode.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }
    }

    throw new Error('Não foi possível gerar um slug único');
  }

  private async generateUniqueSlugs(
    quantity: number,
    tx: Prisma.TransactionClient,
  ): Promise<string[]> {
    for (let attempt = 0; attempt < MAX_BATCH_SLUG_ATTEMPTS; attempt += 1) {
      const candidates = new Set<string>();

      while (candidates.size < quantity) {
        candidates.add(generateSlug());
      }

      const candidateSlugs = [...candidates];
      const existing = await tx.qrCode.findMany({
        where: { slug: { in: candidateSlugs } },
        select: { slug: true },
      });
      const existingSlugs = new Set(existing.map((qrCode) => qrCode.slug));
      const availableSlugs = candidateSlugs.filter(
        (slug) => !existingSlugs.has(slug),
      );

      if (availableSlugs.length === quantity) {
        return availableSlugs;
      }
    }

    throw new Error('Não foi possível gerar slugs únicos para o lote');
  }

  private normalizeFolderName(folder: string): string {
    return folder.trim();
  }

  private toResponse(qrCode: QrCodeWithFolder): QrCodeResponse {
    const publicBaseUrl =
      this.configService.getOrThrow<string>('PUBLIC_BASE_URL');

    return {
      id: qrCode.id,
      name: qrCode.name,
      destinationUrl: qrCode.destinationUrl,
      address: qrCode.address,
      folder: qrCode.folder?.name ?? '',
      color: qrCode.color,
      isInUse: qrCode.isInUse,
      publicUrl: buildPublicUrl(publicBaseUrl, qrCode.slug),
      createdAt: qrCode.createdAt.toISOString(),
    };
  }
}
