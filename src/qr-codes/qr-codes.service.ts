import {
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
    const where = { userId, isActive: true };
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
    const color = dto.color ?? DEFAULT_QR_COLOR;

    const items = await this.prisma.$transaction(async (tx) => {
      const slugs = await this.generateUniqueSlugs(dto.quantity, tx);
      const created: QrCodeWithFolder[] = [];

      for (let index = 0; index < dto.quantity; index += 1) {
        const qrCode = await tx.qrCode.create({
          data: {
            name: `${prefix} ${index + 1}`,
            slug: slugs[index],
            destinationUrl,
            color,
            userId,
            folderId: folder.id,
          },
          include: { folder: true },
        });

        created.push(qrCode);
      }

      return created;
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

  async updateDestination(
    userId: string,
    id: string,
    dto: UpdateQrCodeDto,
  ): Promise<QrCodeResponse> {
    const qrCode = await this.findOwnedQrCode(userId, id, {
      requireActive: true,
    });

    const updated = await this.prisma.qrCode.update({
      where: { id: qrCode.id },
      data: {
        destinationUrl: dto.destinationUrl.trim(),
      },
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
    const slugs: string[] = [];
    const used = new Set<string>();

    while (slugs.length < quantity) {
      let attempts = 0;

      while (attempts < MAX_BATCH_SLUG_ATTEMPTS) {
        const slug = generateSlug();

        if (used.has(slug)) {
          attempts += 1;
          continue;
        }

        const existing = await tx.qrCode.findUnique({
          where: { slug },
          select: { id: true },
        });

        if (!existing) {
          used.add(slug);
          slugs.push(slug);
          break;
        }

        attempts += 1;
      }

      if (attempts >= MAX_BATCH_SLUG_ATTEMPTS) {
        throw new Error('Não foi possível gerar slugs únicos para o lote');
      }
    }

    return slugs;
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
      folder: qrCode.folder?.name ?? '',
      color: qrCode.color,
      publicUrl: buildPublicUrl(publicBaseUrl, qrCode.slug),
      createdAt: qrCode.createdAt.toISOString(),
    };
  }
}
