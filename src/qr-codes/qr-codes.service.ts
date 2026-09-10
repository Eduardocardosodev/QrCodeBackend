import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Folder, QrCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import { UpdateQrCodeDto } from './dto/update-qr-code.dto';
import { QrCodeResponse } from './types/qr-code-response.type';
import { buildPublicUrl } from './utils/public-url.util';
import { generateSlug } from './utils/slug.util';

const DEFAULT_QR_COLOR = '#000000';
const MAX_SLUG_ATTEMPTS = 5;

type QrCodeWithFolder = QrCode & {
  folder: Folder | null;
};

@Injectable()
export class QrCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findAllByUser(userId: string): Promise<QrCodeResponse[]> {
    const qrCodes = await this.prisma.qrCode.findMany({
      where: { userId, isActive: true },
      include: { folder: true },
      orderBy: { createdAt: 'desc' },
    });

    return qrCodes.map((qrCode) => this.toResponse(qrCode));
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

  private async generateUniqueSlug(): Promise<string> {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const slug = generateSlug();
      const existing = await this.prisma.qrCode.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }
    }

    throw new Error('Não foi possível gerar um slug único');
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
